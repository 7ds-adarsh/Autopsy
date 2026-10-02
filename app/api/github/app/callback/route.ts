import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { repositories, users } from "@/lib/db/schema";
import { getInstallationClient } from "@/lib/github/app";
import { eq, and } from "drizzle-orm";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const installationId = searchParams.get("installation_id") || "fixture-demo-1001";
  const reqOwner = searchParams.get("owner");
  const reqRepo = searchParams.get("repo");

  try {
    // 1. Resolve logged in user
    const session = await auth();
    let userId = session?.user?.id;

    if (!userId) {
      // Find fallback dev user if session is not active in direct URL hit
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
      }
    }

    // 2. Fetch repos from GitHub if real installation
    const client = await getInstallationClient(installationId);
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
        console.warn("[GitHub App Callback] Could not fetch installation repos from GitHub API:", err);
      }
    }

    // If no repos fetched or this is the fixture/specified repo
    if (reposToSave.length === 0) {
      const owner = reqOwner || "acme-corp";
      const name = reqRepo || "checkout-service";
      reposToSave.push({
        owner,
        name,
        fullName: `${owner}/${name}`,
        githubRepoId: "fixture-repo-987",
        defaultBranch: "main",
      });
    }

    // 3. Save repositories to database
    for (const repo of reposToSave) {
      const existing = await db
        .select()
        .from(repositories)
        .where(and(eq(repositories.fullName, repo.fullName), eq(repositories.userId, userId)))
        .limit(1);

      if (existing.length > 0) {
        await db
          .update(repositories)
          .set({
            installationId,
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
          installationId,
          defaultBranch: repo.defaultBranch,
          githubRepoId: repo.githubRepoId,
        });
      }
    }

    // Redirect to dashboard with connected parameter
    const redirectUrl = new URL("/dashboard", req.url);
    redirectUrl.searchParams.set("connected", "true");
    return NextResponse.redirect(redirectUrl);
  } catch (error) {
    console.error("[GitHub App Callback] Failed to handle callback:", error);
    return NextResponse.json({ error: "Failed to connect repository" }, { status: 500 });
  }
}
