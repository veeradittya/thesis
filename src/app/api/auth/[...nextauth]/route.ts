import { handlers } from "@/auth";

// Auth.js catch-all route: /api/auth/* (signin, callback, session, signout, csrf).
export const { GET, POST } = handlers;
