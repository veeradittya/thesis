"use client";

import { SessionProvider } from "next-auth/react";

// Client boundary that exposes the Auth.js session to `useSession()` throughout the app.
export function Providers({ children }: { children: React.ReactNode }) {
  return <SessionProvider>{children}</SessionProvider>;
}
