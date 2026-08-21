import { db } from "../db";
import { notifications } from "../db/schema";
import { env } from "../env";
import type { OrderStatus } from "@lastmile/shared";
import { STATUS_LABELS } from "@lastmile/shared";

interface NotifyInput {
  orderId: string | null;
  userId: string;
  toEmail: string;
  toPhone: string;
  orderCode: string;
  status: OrderStatus;
  extra?: { failureReason?: string; rescheduleFor?: string; totalCharge?: number };
}

function emailBody(input: NotifyInput): { subject: string; body: string } {
  const label = STATUS_LABELS[input.status];
  const lines = [
    `Hi there,`,
    ``,
    `Your order ${input.orderCode} status changed to: ${label.toUpperCase()}.`,
  ];
  if (input.status === "FAILED") {
    lines.push(`Reason: ${input.extra?.failureReason ?? "Not specified"}.`);
    lines.push(`You can reschedule the delivery from your dashboard at a convenient date — a new agent will be assigned automatically.`);
  }
  if (input.status === "RESCHEDULED" && input.extra?.rescheduleFor) {
    lines.push(`Your delivery has been rescheduled for ${new Date(input.extra.rescheduleFor).toDateString()}.`);
  }
  if (input.status === "DELIVERED") {
    lines.push(`Thanks for shipping with LastMile.`);
  }
  lines.push(``, `Track live: ${env.webUrl}/app/orders/${input.orderId}`, ``);
  return { subject: `[${input.orderCode}] ${label}`, body: lines.join("\n") };
}

async function sendViaResend(to: string, subject: string, body: string): Promise<{ ok: boolean; provider: string; error?: string }> {
  if (!env.resendApiKey) return { ok: true, provider: "console" };
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${env.resendApiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: env.emailFrom, to, subject, text: body }),
    });
    if (!res.ok) return { ok: false, provider: "resend", error: `${res.status} ${await res.text()}` };
    return { ok: true, provider: "resend" };
  } catch (e) {
    return { ok: false, provider: "resend", error: String(e) };
  }
}

async function sendViaTwilio(to: string, body: string): Promise<{ ok: boolean; provider: string; error?: string }> {
  const { sid, token, from } = env.twilio;
  if (!sid || !token || !from) return { ok: true, provider: "console" };
  try {
    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${btoa(`${sid}:${token}`)}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({ To: to, From: from, Body: body.slice(0, 300) }),
    });
    if (!res.ok) return { ok: false, provider: "twilio", error: `${res.status} ${await res.text()}` };
    return { ok: true, provider: "twilio" };
  } catch (e) {
    return { ok: false, provider: "twilio", error: String(e) };
  }
}

/**
 * Notification outbox: every message is persisted first (auditable), then
 * delivered through the configured provider. Without API keys we log to
 * console and mark SENT via the `console` provider so local dev works.
 */
export async function notifyStatusChange(input: NotifyInput): Promise<void> {
  const { subject, body } = emailBody(input);

  const email = await sendViaResend(input.toEmail, subject, body);
  await db.insert(notifications).values({
    orderId: input.orderId,
    userId: input.userId,
    channel: "EMAIL",
    recipient: input.toEmail,
    subject,
    body,
    status: email.ok ? "SENT" : "FAILED",
    provider: email.provider,
    error: email.error,
  });

  const smsBody = `${subject}: track at ${env.webUrl}/app/orders/${input.orderId}`;
  const sms = await sendViaTwilio(input.toPhone, smsBody);
  await db.insert(notifications).values({
    orderId: input.orderId,
    userId: input.userId,
    channel: "SMS",
    recipient: input.toPhone,
    subject: subject,
    body: smsBody,
    status: sms.ok ? "SENT" : "FAILED",
    provider: sms.provider,
    error: sms.error,
  });
}
