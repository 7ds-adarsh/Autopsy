import NextAuth from "next-auth";
import GitHub from "next-auth/providers/github";
import Credentials from "next-auth/providers/credentials";
import { db } from "./db/client";
import { users } from "./db/schema";
import { eq } from "drizzle-orm";

const providers: any[] = [];

if (process.env.GITHUB_OAUTH_CLIENT_ID && process.env.GITHUB_OAUTH_CLIENT_SECRET) {
  providers.push(
    GitHub({
      clientId: process.env.GITHUB_OAUTH_CLIENT_ID,
      clientSecret: process.env.GITHUB_OAUTH_CLIENT_SECRET,
    })
  );
}

// Dev fallback provider to allow local evaluation without configuring GitHub OAuth app
providers.push(
  Credentials({
    id: "dev-mock-github",
    name: "Dev GitHub Account",
    credentials: {
      username: { label: "Username", type: "text", value: "octocat" },
    },
    async authorize(credentials) {
      const username = (credentials?.username as string) || "octocat";
      const githubId = "mock-123456";
      const avatarUrl = "https://avatars.githubusercontent.com/u/583231?v=4";

      try {
        const [existing] = await db.select().from(users).where(eq(users.githubId, githubId));
        if (existing) {
          return {
            id: existing.id,
            name: existing.username,
            image: existing.avatarUrl,
          };
        }

        const [created] = await db
          .insert(users)
          .values({
            githubId,
            username,
            avatarUrl,
          })
          .returning();

        return {
          id: created.id,
          name: created.username,
          image: created.avatarUrl,
        };
      } catch (err) {
        console.error("Error creating/fetching mock dev user:", err);
        return {
          id: "dev-user-id",
          name: username,
          image: avatarUrl,
        };
      }
    },
  })
);

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers,
  secret: process.env.NEXTAUTH_SECRET || "super-secret-dev-key-at-least-32-chars-long",
  callbacks: {
    async signIn({ user, account, profile }) {
      if (account?.provider === "github" && profile) {
        const githubId = profile.id?.toString() || (profile as any).sub;
        const username = (profile as any).login || profile.name || "GitHub User";
        const avatarUrl = (profile as any).avatar_url || user.image;

        try {
          const [existing] = await db.select().from(users).where(eq(users.githubId, githubId));
          if (!existing) {
            const [created] = await db
              .insert(users)
              .values({
                githubId,
                username,
                avatarUrl,
              })
              .returning();
            user.id = created.id;
          } else {
            user.id = existing.id;
          }
        } catch (error) {
          console.error("Error persisting user on GitHub sign in:", error);
        }
      }
      return true;
    },
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user && token.id) {
        session.user.id = token.id as string;
      }
      return session;
    },
  },
  pages: {
    signIn: "/login",
  },
});
