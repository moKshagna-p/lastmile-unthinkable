import { Hono } from "hono";
import { and, count, desc, eq, inArray, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db } from "../db";
import {
  agents,
  areas,
  codSurcharges,
  notifications,
  orders,
  rateCards,
  trackingEvents,
  users,
  zones,
} from "../db/schema";
import { APIError } from "better-auth/api";
import { auth, currentUser, requireAuth } from "../lib/auth";
import { applyStatusChange, assignAgentToOrder } from "../lib/orders";
import { parse, ValidationError } from "./orders";
import {
  agentProfileSchema,
  areaSchema,
  assignAgentSchema,
  codSurchargeSchema,
  rateCardSchema,
  statusUpdateSchema,
  zoneSchema,
  registerSchema,
} from "@lastmile/shared";

export const adminRoutes = new Hono();

adminRoutes.use("*", requireAuth("ADMIN"));

// ── Dashboard stats ─────────────────────────────────────────────────────────
adminRoutes.get("/stats", async (c) => {
  const byStatus = await db
    .select({ status: orders.status, n: count() })
    .from(orders)
    .groupBy(orders.status);
  const [revenue] = await db
    .select({ total: sql<number>`coalesce(sum(${orders.totalCharge}), 0)` })
    .from(orders)
    .where(inArray(orders.status, ["DELIVERED", "OUT_FOR_DELIVERY", "IN_TRANSIT", "PICKED_UP"]));
  const agentRows = await db.select().from(agents);
  const activeLoads = await db
    .select({ agentId: orders.assignedAgentId, n: count() })
    .from(orders)
    .where(inArray(orders.status, ["ASSIGNED", "PICKED_UP", "IN_TRANSIT", "OUT_FOR_DELIVERY", "RESCHEDULED"]))
    .groupBy(orders.assignedAgentId);

  return c.json({
    ordersByStatus: Object.fromEntries(byStatus.map((r) => [r.status, Number(r.n)])),
    revenue: Number(revenue?.total ?? 0),
    agents: {
      total: agentRows.length,
      available: agentRows.filter((a) => a.status === "AVAILABLE").length,
      load: Object.fromEntries(activeLoads.map((l) => [l.agentId, Number(l.n)])),
    },
  });
});

// ── Zones ───────────────────────────────────────────────────────────────────
adminRoutes.get("/zones", async (c) => {
  const rows = await db.select().from(zones).orderBy(zones.name);
  const areaCounts = await db.select({ zoneId: areas.zoneId, n: count() }).from(areas).groupBy(areas.zoneId);
  const map = new Map(areaCounts.map((a) => [a.zoneId, Number(a.n)]));
  return c.json({ zones: rows.map((z) => ({ ...z, areaCount: map.get(z.id) ?? 0 })) });
});

adminRoutes.post("/zones", async (c) => {
  const body = parse(zoneSchema, await c.req.json());
  const [zone] = await db.insert(zones).values(body).returning();
  return c.json({ zone }, 201);
});

adminRoutes.patch("/zones/:id", async (c) => {
  const body = parse(zoneSchema.partial(), await c.req.json());
  const [zone] = await db.update(zones).set(body).where(eq(zones.id, (c.req.param("id") as string))).returning();
  if (!zone) return c.json({ error: "Zone not found" }, 404);
  return c.json({ zone });
});

adminRoutes.delete("/zones/:id", async (c) => {
  const id = (c.req.param("id") as string);
  const [{ n }] = await db.select({ n: count() }).from(areas).where(eq(areas.zoneId, id));
  if (Number(n) > 0) return c.json({ error: "Zone has areas mapped — move them first" }, 409);
  await db.delete(zones).where(eq(zones.id, id));
  return c.json({ ok: true });
});

// ── Areas (pincode → zone mapping) ──────────────────────────────────────────
adminRoutes.get("/areas", async (c) => {
  const zoneId = c.req.query("zoneId");
  const rows = await db
    .select({ area: areas, zoneName: zones.name })
    .from(areas)
    .innerJoin(zones, eq(areas.zoneId, zones.id))
    .where(zoneId ? eq(areas.zoneId, zoneId) : undefined)
    .orderBy(areas.pincode);
  return c.json({ areas: rows.map((r) => ({ ...r.area, zoneName: r.zoneName })) });
});

adminRoutes.post("/areas", async (c) => {
  const body = parse(areaSchema, await c.req.json());
  const [existing] = await db.select().from(areas).where(eq(areas.pincode, body.pincode)).limit(1);
  if (existing) return c.json({ error: `Pincode ${body.pincode} is already mapped to a zone` }, 409);
  const [area] = await db.insert(areas).values(body).returning();
  return c.json({ area }, 201);
});

adminRoutes.patch("/areas/:id", async (c) => {
  const body = parse(areaSchema.partial(), await c.req.json());
  const [area] = await db.update(areas).set(body).where(eq(areas.id, (c.req.param("id") as string))).returning();
  if (!area) return c.json({ error: "Area not found" }, 404);
  return c.json({ area });
});

adminRoutes.delete("/areas/:id", async (c) => {
  const id = (c.req.param("id") as string);
  const [{ n }] = await db.select({ n: count() }).from(orders).where(eq(orders.pickupAreaId, id));
  if (Number(n) > 0) return c.json({ error: "Area is used by orders — cannot delete" }, 409);
  await db.delete(areas).where(eq(areas.id, id));
  return c.json({ ok: true });
});

// ── Rate cards ──────────────────────────────────────────────────────────────
adminRoutes.get("/rate-cards", async (c) => {
  const fz = alias(zones, "fz");
  const tz = alias(zones, "tz");
  const rows = await db
    .select({
      card: rateCards,
      fromZoneName: fz.name,
      toZoneName: tz.name,
    })
    .from(rateCards)
    .innerJoin(fz, eq(fz.id, rateCards.fromZoneId))
    .innerJoin(tz, eq(tz.id, rateCards.toZoneId))
    .orderBy(rateCards.orderType, fz.name, tz.name);
  return c.json({
    rateCards: rows.map((r) => ({ ...r.card, fromZoneName: r.fromZoneName, toZoneName: r.toZoneName })),
  });
});

adminRoutes.post("/rate-cards", async (c) => {
  const body = parse(rateCardSchema, await c.req.json());
  if (body.active) {
    // Only one active card per (from, to, orderType) — supersede the old one.
    await db
      .update(rateCards)
      .set({ active: false })
      .where(
        and(
          eq(rateCards.fromZoneId, body.fromZoneId),
          eq(rateCards.toZoneId, body.toZoneId),
          eq(rateCards.orderType, body.orderType),
        ),
      );
  }
  const [zoneA] = await db.select().from(zones).where(eq(zones.id, body.fromZoneId)).limit(1);
  const [zoneB] = await db.select().from(zones).where(eq(zones.id, body.toZoneId)).limit(1);
  if (!zoneA || !zoneB) throw new ValidationError("Unknown zone in rate card");
  const name = `${zoneA.name} → ${zoneB.name} · ${body.orderType}`;
  const [card] = await db.insert(rateCards).values({ ...body, name }).returning();
  return c.json({ card }, 201);
});

adminRoutes.patch("/rate-cards/:id", async (c) => {
  const body = parse(rateCardSchema.partial(), await c.req.json());
  const [card] = await db.update(rateCards).set(body).where(eq(rateCards.id, (c.req.param("id") as string))).returning();
  if (!card) return c.json({ error: "Rate card not found" }, 404);
  return c.json({ card });
});

adminRoutes.delete("/rate-cards/:id", async (c) => {
  await db.delete(rateCards).where(eq(rateCards.id, (c.req.param("id") as string)));
  return c.json({ ok: true });
});

// ── COD surcharges ──────────────────────────────────────────────────────────
adminRoutes.get("/cod-surcharges", async (c) => {
  const rows = await db.select().from(codSurcharges).orderBy(codSurcharges.orderType);
  return c.json({ codSurcharges: rows });
});

adminRoutes.put("/cod-surcharges/:orderType", async (c) => {
  const orderType = (c.req.param("orderType") as string).toUpperCase();
  if (!["B2B", "B2C"].includes(orderType)) throw new ValidationError("orderType must be B2B or B2C");
  const body = parse(codSurchargeSchema.omit({ orderType: true }), await c.req.json());
  const [row] = await db
    .insert(codSurcharges)
    .values({ orderType: orderType as "B2B" | "B2C", ...body, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: codSurcharges.orderType,
      set: { percent: body.percent, flatFee: body.flatFee, active: body.active, updatedAt: new Date() },
    })
    .returning();
  return c.json({ codSurcharge: row });
});

// ── Agents ──────────────────────────────────────────────────────────────────
adminRoutes.get("/agents", async (c) => {
  const rows = await db
    .select({ agent: agents, user: users, zoneName: zones.name })
    .from(agents)
    .innerJoin(users, eq(agents.userId, users.id))
    .leftJoin(zones, eq(agents.homeZoneId, zones.id))
    .orderBy(agents.code);

  const loads = await db
    .select({ agentId: orders.assignedAgentId, n: count() })
    .from(orders)
    .where(inArray(orders.status, ["ASSIGNED", "PICKED_UP", "IN_TRANSIT", "OUT_FOR_DELIVERY", "RESCHEDULED"]))
    .groupBy(orders.assignedAgentId);
  const loadMap = new Map(loads.map((l) => [l.agentId, Number(l.n)]));

  return c.json({
    agents: rows.map((r) => ({
      ...r.agent,
      name: r.user.name,
      email: r.user.email,
      phone: r.user.phone,
      zoneName: r.zoneName,
      activeLoad: loadMap.get(r.agent.id) ?? 0,
    })),
  });
});

/** Create an agent (user account via Better Auth + agent profile). */
adminRoutes.post("/agents", async (c) => {
  const raw = await c.req.json();
  const profile = parse(agentProfileSchema, raw);
  const account = parse(registerSchema, raw.account);

  let userId: string;
  try {
    // Server-side credential sign-up; role is NOT settable by clients, so we
    // grant AGENT in a follow-up write.
    const res = await auth.api.signUpEmail({
      body: {
        email: account.email,
        password: account.password,
        name: account.name,
        phone: account.phone,
      },
    });
    userId = res.user.id;
  } catch (e) {
    if (e instanceof APIError) {
      return c.json({ error: e.message || "Could not create agent account" }, 409);
    }
    throw e;
  }
  await db.update(users).set({ role: "AGENT" }).where(eq(users.id, userId));

  const [agent] = await db
    .insert(agents)
    .values({
      userId,
      code: profile.code,
      vehicle: profile.vehicle,
      capacity: profile.capacity,
      currentLat: profile.currentLat,
      currentLng: profile.currentLng,
      homeZoneId: profile.zoneId ?? null,
    })
    .returning();

  return c.json({ agent }, 201);
});

adminRoutes.patch("/agents/:id", async (c) => {
  const raw = await c.req.json();
  const patch: Record<string, unknown> = {};
  if (raw.status === "AVAILABLE" || raw.status === "OFFLINE") patch.status = raw.status;
  if (typeof raw.capacity === "number") patch.capacity = raw.capacity;
  if (typeof raw.vehicle === "string") patch.vehicle = raw.vehicle;
  if (typeof raw.homeZoneId === "string" || raw.homeZoneId === null) patch.homeZoneId = raw.homeZoneId;
  if (typeof raw.currentLat === "number") patch.currentLat = raw.currentLat;
  if (typeof raw.currentLng === "number") patch.currentLng = raw.currentLng;

  const [agent] = await db.update(agents).set(patch).where(eq(agents.id, (c.req.param("id") as string))).returning();
  if (!agent) return c.json({ error: "Agent not found" }, 404);
  return c.json({ agent });
});

// ── Users (customers list for on-behalf creation) ───────────────────────────
adminRoutes.get("/users", async (c) => {
  const role = c.req.query("role");
  const rows = await db
    .select({ id: users.id, name: users.name, email: users.email, phone: users.phone, role: users.role })
    .from(users)
    .where(role ? eq(users.role, role as any) : undefined)
    .orderBy(users.name);
  return c.json({ users: rows });
});

// ── Orders: view all + filters ──────────────────────────────────────────────
adminRoutes.get("/orders", async (c) => {
  const conditions = [];
  const status = c.req.query("status");
  const zoneId = c.req.query("zoneId");
  const agentId = c.req.query("agentId");

  if (status) conditions.push(eq(orders.status, status as any));
  if (zoneId) {
    conditions.push(
      sql`(${orders.pickupZoneId} = ${zoneId} OR ${orders.dropZoneId} = ${zoneId})`,
    );
  }
  if (agentId) conditions.push(eq(orders.assignedAgentId, agentId));

  const rows = await db
    .select({ order: orders, customerName: users.name })
    .from(orders)
    .innerJoin(users, eq(orders.customerId, users.id))
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(orders.createdAt))
    .limit(300);

  return c.json({
    orders: rows.map((r) => ({ ...r.order, customerName: r.customerName })),
  });
});

/** Admin override of any order status. */
adminRoutes.patch("/orders/:id/status", async (c) => {
  const actor = currentUser(c)!;
  const body = parse(statusUpdateSchema, await c.req.json());
  const result = await applyStatusChange({
    orderId: (c.req.param("id") as string),
    toStatus: body.status,
    actor,
    note: body.note ?? "Admin override",
    meta: { override: true },
  });
  return c.json(result);
});

/** Manual or auto assignment. */
adminRoutes.post("/orders/:id/assign", async (c) => {
  const actor = currentUser(c)!;
  const body = parse(assignAgentSchema, await c.req.json().catch(() => ({})));
  const result = await assignAgentToOrder({
    orderId: (c.req.param("id") as string),
    actor,
    agentId: body.agentId,
    auto: body.auto ?? !body.agentId,
  });
  return c.json(result);
});
