import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { repositories } from "@/lib/db/schema";
import { scanRepository } from "@/lib/scanner";
import { eq } from "drizzle-orm";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const [repo] = await db
      .select()
      .from(repositories)
      .where(eq(repositories.id, id))
      .limit(1);

    if (!repo) {
      return NextResponse.json({ error: "Repository not found" }, { status: 404 });
    }

    const scanResult = await scanRepository(
      repo.id,
      repo.owner,
      repo.name,
      repo.installationId || "fixture-demo",
      repo.defaultBranch || "main"
    );

    return NextResponse.json({
      repository: repo,
      ...scanResult,
    });
  } catch (error) {
    console.error("[API Scan] Error scanning repository:", error);
    return NextResponse.json(
      { error: "Failed to scan repository" },
      { status: 500 }
    );
  }
}
