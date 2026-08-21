/** Central env access with dev defaults — fail fast on missing prod secrets. */
function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env var: ${name}`);
  return v;
}

export const env = {
  get databaseUrl() {
    return process.env.DATABASE_URL ?? "postgresql://postgres:postgres@localhost:5432/lastmile";
  },
  /** Better Auth signing secret — REQUIRED in production. */
  get betterAuthSecret() {
    return process.env.BETTER_AUTH_SECRET ?? "dev-only-secret-change-me";
  },
  /** Public base URL of this API — Better Auth issues cookies against it. */
  get betterAuthUrl() {
    return process.env.BETTER_AUTH_URL ?? `http://localhost:${process.env.API_PORT ?? 4000}`;
  },
  get webUrl() {
    return process.env.WEB_URL ?? "http://localhost:3000";
  },
  get port() {
    return Number(process.env.API_PORT ?? 4000);
  },
  get agentMaxRadiusKm() {
    return Number(process.env.AGENT_MAX_RADIUS_KM ?? 25);
  },
  get resendApiKey() {
    return process.env.RESEND_API_KEY || "";
  },
  get emailFrom() {
    return process.env.EMAIL_FROM || "LastMile <onboarding@resend.dev>";
  },
  get twilio() {
    return {
      sid: process.env.TWILIO_ACCOUNT_SID || "",
      token: process.env.TWILIO_AUTH_TOKEN || "",
      from: process.env.TWILIO_FROM_NUMBER || "",
    };
  },
};
