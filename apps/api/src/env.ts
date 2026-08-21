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
  get jwtSecret() {
    return process.env.JWT_SECRET ?? "dev-only-secret-change-me";
  },
  get jwtExpiresIn() {
    return process.env.JWT_EXPIRES_IN ?? "7d";
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
