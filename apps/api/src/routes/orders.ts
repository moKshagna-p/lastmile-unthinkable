import { Hono } from "hono";
import { and, desc, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { ZodError } from "zod";
import { db } from "../db";
import { agents, areas, orders, trackingEvents, users, zones } from "../db/schema";
import { currentUser, requireAuth } from "../lib/auth";
import { PricingError, quote } from "../lib/pricing";
import { applyStatusChange, generateOrderCode, rescheduleOrder } from "../lib/orders";
import {
  createOrderSchema,
  quoteSchema,
  rescheduleSchema,
  statusUpdateSchema,
} from "@lastmile/shared";

export const orderRoutes = new Hono();

/** Parse helper → uniform 400s. */
export function parse<T extends z.ZodTypeAny>(schema: T, data: unknown): z.infer<T> {
  try {
    return schema.parse(data);
  } catch (e) {
    if (e instanceof ZodError) {
      throw new ValidationError(e.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "));
    }
    throw e;
  }
}

export class ValidationError extends Error {
  status = 400;
}

// ── Serviceable areas (any signed-in user — used by order forms) ───────────
orderRoutes.get("/meta/areas", requireAuth(), async (c) => {
  const rows = await db
    .select({ area: areas, zoneName: zones.name })
    .from(areas)
    .innerJoin(zones, eq(areas.zoneId, zones.id))
    .orderBy(areas.pincode);
  return c.json({
    areas: rows.map((r) => ({
      id: r.area.id, name: r.area.name, pincode: r.area.pincode,
      city: r.area.city, zoneId: r.area.zoneId, zoneName: r.zoneName,
    })),
  });
});

// ── Quote (charge preview before confirming) ────────────────────────────────
orderRoutes.post("/quote", requireAuth("CUSTOMER", "ADMIN"), async (c) => {
  const body = parse(quoteSchema, await c.req.json());
  const result = await quote(body);
  return c.json({ quote: result });
});

// ── Create order (customer self-service or admin on behalf) ────────────────
orderRoutes.post("/", requireAuth("CUSTOMER", "ADMIN"), async (c) => {
  const actor = currentUser(c)!;
  const raw = await c.req.json();
  const body = parse(createOrderSchema, raw);

  // Server-side recalculation — client-supplied charges are never trusted.
  const q = await quote({
    pickupAreaId: body.pickupAreaId,
    dropAreaId: body.dropAreaId,
    lengthCm: body.lengthCm,
    breadthCm: body.breadthCm,
    heightCm: body.heightCm,
    actualWeightKg: body.actualWeightKg,
    orderType: body.orderType,
    paymentType: body.paymentType,
    codAmount: body.codAmount,
  });

  // Admin may create on behalf of an explicit customer.
  let customerId = actor.id;
  if (actor.role === "ADMIN") {
    const explicitCustomer = (raw as Record<string, unknown>)?.customerId as string | undefined;
    if (explicitCustomer) {
      const [cust] = await db.select().from(users).where(eq(users.id, explicitCustomer)).limit(1);
      if (!cust || cust.role !== "CUSTOMER") return c.json({ error: "Invalid customer" }, 400);
      customerId = cust.id;
    }
  }

  const code = await generateOrderCode();
  const [order] = await db.transaction(async (tx) => {
    const [o] = await tx
      .insert(orders)
      .values({
        code,
        customerId,
        createdByUserId: actor.id,
        pickupContactName: body.pickup.contactName,
        pickupContactPhone: body.pickup.contactPhone,
        pickupLine1: body.pickup.line1,
        pickupAreaId: body.pickup.areaId,
        dropContactName: body.drop.contactName,
        dropContactPhone: body.drop.contactPhone,
        dropLine1: body.drop.line1,
        dropAreaId: body.drop.areaId,
        lengthCm: body.lengthCm,
        breadthCm: body.breadthCm,
        heightCm: body.heightCm,
        actualWeightKg: body.actualWeightKg,
        orderType: body.orderType,
        paymentType: body.paymentType,
        codAmount: body.paymentType === "COD" ? (body.codAmount ?? 0) : null,
        volumetricWeightKg: q.volumetricWeightKg,
        billableWeightKg: q.billableWeightKg,
        freightCharge: q.freightCharge,
        codSurcharge: q.codSurcharge,
        totalCharge: q.totalCharge,
        appliedRateCardId: q.appliedRateCardId,
        pickupZoneId: q.pickupZoneId,
        dropZoneId: q.dropZoneId,
      })
      .returning();

    await tx.insert(trackingEvents).values({
      orderId: o.id,
      status: "PLACED",
      note: `Order placed — charge ₹${q.totalCharge.toFixed(2)} (${q.rateCardName})`,
      actorUserId: actor.id,
      actorRole: actor.role,
      actorName: actor.name,
      meta: { quote: q },
    });
    return [o];
  });

  return c.json({ order }, 201);
});

// ── List orders (scoped by role) ────────────────────────────────────────────
orderRoutes.get("/", requireAuth(), async (c) => {
  const actor = currentUser(c)!;
  const status = c.req.query("status");

  const conditions = [];
  if (actor.role === "CUSTOMER") conditions.push(eq(orders.customerId, actor.id));
  if (status) conditions.push(eq(orders.status, status as any));

  const rows = await db
    .select()
    .from(orders)
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(orders.createdAt))
    .limit(200);

  return c.json({ orders: rows });
});

// ── Order detail with full timeline ─────────────────────────────────────────
orderRoutes.get("/:id", requireAuth(), async (c) => {
  const actor = currentUser(c)!;
  const id = (c.req.param("id") as string);

  const [row] = await db
    .select({
      order: orders,
      pickupArea: areas,
    })
    .from(orders)
    .leftJoin(areas, eq(orders.pickupAreaId, areas.id))
    .where(eq(orders.id, id))
    .limit(1);
  if (!row) return c.json({ error: "Order not found" }, 404);

  const order = row.order;
  const isOwner = order.customerId === actor.id;
  const isAdmin = actor.role === "ADMIN";

  let isAssignedAgent = false;
  if (actor.role === "AGENT") {
    const [agent] = await db.select().from(agents).where(eq(agents.userId, actor.id)).limit(1);
    isAssignedAgent = !!agent && agent.id === order.assignedAgentId;
  }

  if (!isOwner && !isAdmin && !isAssignedAgent) {
    return c.json({ error: "Forbidden" }, 403);
  }

  const events = await db
    .select()
    .from(trackingEvents)
    .where(eq(trackingEvents.orderId, id))
    .orderBy(trackingEvents.createdAt);

  const [dropArea] = await db.select().from(areas).where(eq(areas.id, order.dropAreaId)).limit(1);
  const [pickupAreaFull] = await db.select().from(areas).where(eq(areas.id, order.pickupAreaId)).limit(1);

  let agentInfo = null;
  if (order.assignedAgentId) {
    const [a] = await db
      .select({ agent: agents, name: users.name, phone: users.phone })
      .from(agents)
      .innerJoin(users, eq(agents.userId, users.id))
      .where(eq(agents.id, order.assignedAgentId))
      .limit(1);
    if (a) agentInfo = { id: a.agent.id, code: a.agent.code, name: a.name, phone: a.phone };
  }

  return c.json({ order, events, agent: agentInfo, pickupArea: pickupAreaFull, dropArea });
});

// ── Reschedule after failed delivery (customer or admin) ────────────────────
orderRoutes.post("/:id/reschedule", requireAuth("CUSTOMER", "ADMIN"), async (c) => {
  const actor = currentUser(c)!;
  const id = (c.req.param("id") as string);
  const body = parse(rescheduleSchema, await c.req.json());

  const [order] = await db.select().from(orders).where(eq(orders.id, id)).limit(1);
  if (!order) return c.json({ error: "Order not found" }, 404);
  if (actor.role === "CUSTOMER" && order.customerId !== actor.id) {
    return c.json({ error: "Forbidden" }, 403);
  }

  const result = await rescheduleOrder({
    orderId: id,
    actor,
    rescheduleFor: body.rescheduleFor,
    note: body.note,
  });
  return c.json(result);
});
