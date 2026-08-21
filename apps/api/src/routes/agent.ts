import { Hono } from "hono";
import { and, desc, eq, inArray } from "drizzle-orm";
import { db } from "../db";
import { agents, orders, users, zones } from "../db/schema";
import { currentUser, requireAuth } from "../lib/auth";
import { applyStatusChange } from "../lib/orders";
import { parse } from "./orders";
import { agentLocationSchema, agentStatusSchema, statusUpdateSchema } from "@lastmile/shared";

export const agentRoutes = new Hono();

agentRoutes.use("*", requireAuth("AGENT"));

async function agentForUser(userId: string) {
  const [row] = await db
    .select({ agent: agents, user: users })
    .from(agents)
    .innerJoin(users, eq(agents.userId, users.id))
    .where(eq(agents.userId, userId))
    .limit(1);
  return row ?? null;
}

agentRoutes.get("/me", async (c) => {
  const actor = currentUser(c)!;
  const row = await agentForUser(actor.id);
  if (!row) return c.json({ error: "Agent profile not found" }, 404);
  return c.json({ agent: row.agent, name: row.user.name });
});

/** Orders currently assigned to this agent. */
agentRoutes.get("/orders", async (c) => {
  const actor = currentUser(c)!;
  const me = await agentForUser(actor.id);
  if (!me) return c.json({ error: "Agent profile not found" }, 404);

  const rows = await db
    .select({ order: orders, customerName: users.name, customerPhone: users.phone })
    .from(orders)
    .innerJoin(users, eq(orders.customerId, users.id))
    .where(
      and(
        eq(orders.assignedAgentId, me.agent.id),
        inArray(orders.status, ["ASSIGNED", "PICKED_UP", "IN_TRANSIT", "OUT_FOR_DELIVERY", "RESCHEDULED"]),
      ),
    )
    .orderBy(desc(orders.updatedAt));

  return c.json({
    orders: rows.map((r) => ({ ...r.order, customerName: r.customerName, customerPhone: r.customerPhone })),
  });
});

/** Status scan by the delivery agent (PICKED_UP / IN_TRANSIT / …). */
agentRoutes.post("/orders/:id/status", async (c) => {
  const actor = currentUser(c)!;
  const me = await agentForUser(actor.id);
  if (!me) return c.json({ error: "Agent profile not found" }, 404);

  const id = (c.req.param("id") as string);
  const [order] = await db.select().from(orders).where(eq(orders.id, id)).limit(1);
  if (!order) return c.json({ error: "Order not found" }, 404);
  if (order.assignedAgentId !== me.agent.id) {
    return c.json({ error: "This order is not assigned to you" }, 403);
  }

  const body = parse(statusUpdateSchema, await c.req.json());

  // Agents may only advance the shipment lifecycle; FAILED carries a reason.
  if (!["PICKED_UP", "IN_TRANSIT", "OUT_FOR_DELIVERY", "DELIVERED", "FAILED"].includes(body.status)) {
    return c.json({ error: `Agents cannot set status ${body.status}` }, 403);
  }
  if (body.status === "FAILED" && !body.note) {
    return c.json({ error: "A failure reason is required" }, 400);
  }

  // Location ping with each scan keeps live tracking fresh.
  if (typeof body.lat === "number" && typeof body.lng === "number") {
    await db
      .update(agents)
      .set({ currentLat: body.lat, currentLng: body.lng })
      .where(eq(agents.id, me.agent.id));
  }

  const result = await applyStatusChange({
    orderId: id,
    toStatus: body.status,
    actor,
    note: body.note,
    meta: { lat: body.lat, lng: body.lng },
  });
  return c.json(result);
});

/** Live location update (used by auto-assignment scoring). */
agentRoutes.post("/location", async (c) => {
  const actor = currentUser(c)!;
  const me = await agentForUser(actor.id);
  if (!me) return c.json({ error: "Agent profile not found" }, 404);
  const body = parse(agentLocationSchema, await c.req.json());
  await db
    .update(agents)
    .set({ currentLat: body.lat, currentLng: body.lng })
    .where(eq(agents.id, me.agent.id));
  return c.json({ ok: true });
});

agentRoutes.patch("/status", async (c) => {
  const actor = currentUser(c)!;
  const me = await agentForUser(actor.id);
  if (!me) return c.json({ error: "Agent profile not found" }, 404);
  const body = parse(agentStatusSchema, await c.req.json());
  const [agent] = await db.update(agents).set({ status: body.status }).where(eq(agents.id, me.agent.id)).returning();
  return c.json({ agent });
});
