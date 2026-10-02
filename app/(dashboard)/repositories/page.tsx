import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { repositories, users } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
import { RepositoriesView, RepositoryItem } from "@/components/repositories-view";

export default async function RepositoriesPage() {
  const session = await auth();
  let userId = session?.user?.id;

  if (!userId) {
    const [firstUser] = await db.select().from(users).limit(1);
    userId = firstUser?.id;
  }

  let userRepos: RepositoryItem[] = [];
  if (userId) {
    const records = await db
      .select()
      .from(repositories)
      .where(eq(repositories.userId, userId))
      .orderBy(desc(repositories.createdAt));

    userRepos = records.map((r) => ({
      id: r.id,
      owner: r.owner,
      name: r.name,
      fullName: r.fullName,
      installationId: r.installationId,
      defaultBranch: r.defaultBranch,
      createdAt: r.createdAt.toISOString(),
    }));
  }

  return (
    <div className="p-8 max-w-6xl w-full mx-auto">
      <RepositoriesView initialRepositories={userRepos} />
    </div>
  );
}
