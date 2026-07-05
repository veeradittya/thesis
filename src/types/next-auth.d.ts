import type { DefaultSession } from "next-auth";

// Add the stable account id (Google `sub`, set in auth.ts's session callback) to the
// session user type, so `session.user.id` is available for per-user persistence scoping.
declare module "next-auth" {
  interface Session {
    user: { id?: string } & DefaultSession["user"];
  }
}
