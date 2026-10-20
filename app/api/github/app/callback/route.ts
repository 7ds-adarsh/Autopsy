/**
 * GET /api/github/app/callback
 *
 * GitHub App installation callback. Called by GitHub after the user installs
 * the app on a repository.
 *
 * PRODUCTION SAFETY:
 * - Requires an authenticated session. Unauthenticated requests → 401.
 * - Mock user creation and fixture repository fallback are ONLY allowed in
 *   local development (NODE_ENV !== 'production').
 * - In production, if the GitHub API returns no repositories for a valid
 *   installation, the callback redirects back with an error rather than
 *   silently creating a fake repo.
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { repositories, users } from "@/lib/db/schema";
import { getInstallationClient } from "@/lib/github/app";
import { eq, and } from "drizzle-orm";

const IS_DEV = process.env.NODE_ENV !== "production";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const installationId = searchParams.get("installation_id");
  const reqOwner = searchParams.get("owner");
  const reqRepo = searchParams.get("repo");

  // In dev: allow fixture installation IDs for local testing
  const effectiveInstallationId =
    installationId || (IS_DEV ? "fixture-demo-1001" : null);

  if (!effectiveInstallationId) {
    console.error("[GitHub App Callback] Missing installation_id in production");
    return NextResponse.json(
      { error: "Missing installation_id" },
      { status: 400 }
    );
  }

  try {
    // 1. Resolve authenticated user
    const session = await auth();
    let userId = session?.user?.id;

    if (!userId) {
      if (!IS_DEV) {
        // Production: reject unauthenticated callbacks
        const loginUrl = new URL("/login", req.url);
        loginUrl.searchParams.set("callbackUrl", req.url);
        return NextResponse.redirect(loginUrl);
      }

      // Dev only: use or create the dev mock user
      const [existingUser] = await db.select().from(users).limit(1);
      if (existingUser) {
        userId = existingUser.id;
      } else {
        const [devUser] = await db
          .insert(users)
          .values({
            githubId: "mock-123456",
            username: "octocat",
            avatarUrl: "https://avatars.githubusercontent.com/u/583231?v=4",
          })
          .returning();
        userId = devUser.id;
        console.log("[GitHub App Callback] Dev: created mock user", userId);
      }
    }

    // 2. Fetch repos from GitHub for real installations
    const client = await getInstallationClient(effectiveInstallationId);
    const reposToSave: {
      owner: string;
      name: string;
      fullName: string;
      githubRepoId?: string;
      defaultBranch: string;
    }[] = [];

    if (client) {
      try {
        const { data } = await client.rest.apps.listReposAccessibleToInstallation({
          per_page: 20,
        });

        for (const repo of data.repositories) {
          reposToSave.push({
            owner: repo.owner.login,
            name: repo.name,
            fullName: repo.full_name,
            githubRepoId: repo.id.toString(),
            defaultBranch: repo.default_branch || "main",
          });
        }
      } catch (err) {
        console.warn(
          "[GitHub App Callback] Could not fetch installation repos from GitHub API:",
          err
        );
      }
    }

    // Fallback: fixture or explicit repo — DEV ONLY
    if (reposToSave.length === 0) {
      if (!IS_DEV) {
        // Production: do not fabricate a repository
        console.error(
          `[GitHub App Callback] No repositories returned for installation ${effectiveInstallationId} in production`
        );
        const dashUrl = new URL("/dashboard", req.url);
        dashUrl.searchParams.set("error", "no-repos");
        return NextResponse.redirect(dashUrl);
      }

      // Dev only: use explicit owner/repo or the canonical fixture
      const owner = reqOwner || "acme-corp";
      const name = reqRepo || "checkout-service";
      reposToSave.push({
        owner,
        name,
        fullName: `${owner}/${name}`,
        githubRepoId: "fixture-repo-987",
        defaultBranch: "main",
      });
      console.log(
        `[GitHub App Callback] Dev: using fixture repo ${owner}/${name}`
      );
    }

    // 3. Upsert repositories
    for (const repo of reposToSave) {
      const existing = await db
        .select()
        .from(repositories)
        .where(
          and(
            eq(repositories.fullName, repo.fullName),
            eq(repositories.userId, userId)
          )
        )
        .limit(1);

      if (existing.length > 0) {
        await db
          .update(repositories)
          .set({
            installationId: effectiveInstallationId,
            defaultBranch: repo.defaultBranch,
            githubRepoId: repo.githubRepoId,
          })
          .where(eq(repositories.id, existing[0].id));
      } else {
        await db.insert(repositories).values({
          userId,
          owner: repo.owner,
          name: repo.name,
          fullName: repo.fullName,
          installationId: effectiveInstallationId,
          defaultBranch: repo.defaultBranch,
          githubRepoId: repo.githubRepoId,
        });
      }
    }

    const redirectUrl = new URL("/dashboard", req.url);
    redirectUrl.searchParams.set("connected", "true");
    return NextResponse.redirect(redirectUrl);
  } catch (error) {
    console.error("[GitHub App Callback] Failed to handle callback:", error);
    return NextResponse.json(
      { error: "Failed to connect repository" },
      { status: 500 }
    );
  }
}
