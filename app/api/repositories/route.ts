import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { repositories, users } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";

export async function GET() {
  const session = await auth();
  let userId = session?.user?.id;

  if (!userId) {
    if (process.env.NODE_ENV === "production") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const [firstUser] = await db.select().from(users).limit(1);
    if (!firstUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    userId = firstUser.id;
  }

  const userRepos = await db
    .select()
    .from(repositories)
    .where(eq(repositories.userId, userId))
    .orderBy(desc(repositories.createdAt));

  return NextResponse.json(userRepos);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  let userId = session?.user?.id;

  if (!userId) {
    if (process.env.NODE_ENV === "production") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const [firstUser] = await db.select().from(users).limit(1);
    if (!firstUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    userId = firstUser.id;
  }

  try {
    const body = await req.json();
    const { owner, name, installationId, defaultBranch = "main", githubRepoId } = body;

    if (!owner || !name) {
      return NextResponse.json({ error: "Owner and name are required" }, { status: 400 });
    }

    const fullName = `${owner}/${name}`;

    const [repo] = await db
      .insert(repositories)
      .values({
        userId,
        owner,
        name,
        fullName,
        installationId: installationId || "fixture-demo-1001",
        defaultBranch,
        githubRepoId: githubRepoId || `repo_${Date.now()}`,
      })
      .returning();

    return NextResponse.json(repo, { status: 201 });
  } catch (error) {
    console.error("[API Repositories] Error creating repository:", error);
    return NextResponse.json({ error: "Failed to create repository" }, { status: 500 });
  }
}
