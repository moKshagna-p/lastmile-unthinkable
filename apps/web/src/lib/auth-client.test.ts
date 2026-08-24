import { expect, test } from "bun:test";

test("sends registration to the API auth route", async () => {
  const originalFetch = globalThis.fetch;
  process.env.NEXT_PUBLIC_API_URL = "https://web.example/backend";
  let requestedUrl = "";
  globalThis.fetch = Object.assign(
    async (input: RequestInfo | URL) => {
      requestedUrl = String(input);
      return Response.json({ message: "stop after routing" }, { status: 400 });
    },
    { preconnect: originalFetch.preconnect },
  );

  try {
    const { authClient } = await import("./auth-client");
    await authClient.signUp.email({
      name: "Test User",
      email: "test@example.com",
      password: "password123",
    });
    expect(requestedUrl).toBe("https://web.example/backend/api/auth/sign-up/email");
  } finally {
    globalThis.fetch = originalFetch;
    delete process.env.NEXT_PUBLIC_API_URL;
  }
});
