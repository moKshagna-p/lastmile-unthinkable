"use client";

import { createAuthClient } from "better-auth/react";
import { API_URL } from "@/lib/api";

/**
 * Better Auth client — cookie sessions against the API at API_URL.
 * No tokens in localStorage: the httpOnly session cookie is the only
 * credential, sent automatically with credentials: "include".
 *
 * The server adds `phone` + `role` as additionalFields; the generic client
 * types don't carry them, so SessionUser is asserted at call sites.
 */
export const authClient = createAuthClient({
  baseURL: `${API_URL}/api/auth`,
  fetchOptions: { credentials: "include" },
});

export interface SessionUser {
  id: string;
  name: string;
  email: string;
  role: "CUSTOMER" | "AGENT" | "ADMIN";
  phone?: string;
}
