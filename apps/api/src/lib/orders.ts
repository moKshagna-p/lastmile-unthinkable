import { and, desc, eq, inArray } from "drizzle-orm";
import { db } from "../db";
import { agents, areas, orders, trackingEvents, users } from "../db/schema";
import { canTransition, type OrderStatus } from "@lastmile/shared";
import type { AuthUser } from "./auth";
import { notifyStatusChange } from "./notify";
import { findNearestAgent } from "./assignment";

export class LifecycleError extends Error {
  status = 409;
}

export async function generateOrderCode(): Promise<string> {
  const [row] = await db.select({ id: orders.id }).from(orders).orderBy(desc(orders.createdAt)).limit(1);
  const n = (await db.$count(orders)) + 1;
  return `LM-${new Date().getFullYear()}-${String(n).padStart(5, "0")}`;
}

/**
 * Applies a status change to an order:
 *   1. validates the transition against the lifecycle state machine,
 *   2. appends an immutable tracking event (actor + timestamp),
 *   3. updates the order row,
 *   4. notifies the customer on every status change.
 * All four steps run in a transaction so history and state never diverge.
 */
export async function applyStatusChange(opts: {
  orderId: string;
  toStatus: OrderStatus;
  actor: AuthUser;
  note?: string;
  meta?: Record<string, unknown>;
}): Promise<{ id: string; status: OrderStatus }> {
  return db.transaction(async (tx) => {
    const [order] = await tx.select().from(orders).where(eq(orders.id, opts.orderId)).limit(1);
    if (!order) throw new LifecycleError("Order not found");

    if (order.status === opts.toStatus) {
      throw new LifecycleError(`Order is already ${opts.toStatus}`);
    }
    if (!canTransition(order.status, opts.toStatus)) {
      throw new LifecycleError(`Illegal transition ${order.status} → ${opts.toStatus}`);
    }

    // Side-effects per target status
    const patch: Partial<typeof orders.$inferInsert> = {
      status: opts.toStatus,
      updatedAt: new Date(),
    };

    if (opts.toStatus === "FAILED") {
      patch.failureReason = opts.note ?? "Delivery attempt failed";
    }
    const failureReason =
      typeof patch.failureReason === "string" ? patch.failureReason : undefined;
    if (order.assignedAgentId) {
      await maybeFreeAgent(tx, order.assignedAgentId);
    }

    await tx.update(orders).set(patch).where(eq(orders.id, order.id));

    await tx.insert(trackingEvents).values({
      orderId: order.id,
      status: opts.toStatus,
      note: opts.note,
      actorUserId: opts.actor.id,
      actorRole: opts.actor.role,
      actorName: opts.actor.name,
      meta: opts.meta,
    });

    // Customer notification on every status change
    const [customer] = await tx.select().from(users).where(eq(users.id, order.customerId)).limit(1);
    if (customer) {
      await notifyStatusChange({
        orderId: order.id,
        userId: customer.id,
        toEmail: customer.email,
        toPhone: customer.phone,
        orderCode: order.code,
        status: opts.toStatus,
        extra: {
          failureReason,
          totalCharge: order.totalCharge,
        },
      });
    }

    return { id: order.id, status: opts.toStatus };
  });
}

/** Returns an agent to AVAILABLE once none of their orders are active anymore. */
async function maybeFreeAgent(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  agentId: string,
) {
  const active = await tx
    .select({ id: orders.id })
    .from(orders)
    .where(
      and(
        eq(orders.assignedAgentId, agentId),
        inArray(orders.status, ["ASSIGNED", "PICKED_UP", "IN_TRANSIT", "OUT_FOR_DELIVERY", "RESCHEDULED"]),
      ),
    );
  if (active.length === 0) {
    await tx.update(agents).set({ status: "AVAILABLE" }).where(eq(agents.id, agentId));
  }
}

/** Manual or automatic agent assignment. */
export async function assignAgentToOrder(opts: {
  orderId: string;
  actor: AuthUser;
  agentId?: string; // manual
  auto?: boolean;
}): Promise<{ agentId: string | null; agentCode: string | null }> {
  const [order] = await db.select().from(orders).where(eq(orders.id, opts.orderId)).limit(1);
  if (!order) throw new LifecycleError("Order not found");
  if (!["PLACED", "RESCHEDULED", "ASSIGNED"].includes(order.status)) {
    throw new LifecycleError(`Cannot assign an agent while order is ${order.status}`);
  }

  let agentId = opts.agentId ?? null;
  let autoUsed = false;

  if (!agentId && opts.auto !== false) {
    const nearest = await findNearestAgent(order.pickupAreaId);
    if (!nearest) {
      throw new LifecycleError(
        "No available agent within range. Widen the radius, bring agents online, or assign manually.",
      );
    }
    agentId = nearest.agentId;
    autoUsed = true;
  }

  if (!agentId) throw new LifecycleError("agentId is required for manual assignment");

  const [agent] = await db.select().from(agents).where(eq(agents.id, agentId)).limit(1);
  if (!agent) throw new LifecycleError("Agent not found");
  if (agent.status === "OFFLINE") throw new LifecycleError("Agent is offline");

  await db.transaction(async (tx) => {
    await tx
      .update(orders)
      .set({
        assignedAgentId: agent.id,
        assignedAt: new Date(),
        // First assignment moves the order into the active lifecycle.
        ...(order.status === "PLACED" || order.status === "RESCHEDULED"
          ? { status: "ASSIGNED" as const }
          : {}),
        updatedAt: new Date(),
      })
      .where(eq(orders.id, order.id));

    await tx.insert(trackingEvents).values({
      orderId: order.id,
      status: "ASSIGNED",
      note: autoUsed
        ? `Auto-assigned to ${agent.code} (nearest available agent)`
        : `Manually assigned to ${agent.code}`,
      actorUserId: opts.actor.id,
      actorRole: opts.actor.role,
      actorName: opts.actor.name,
      meta: { agentCode: agent.code, auto: autoUsed },
    });

    // Agent becomes BUSY-equivalent when at capacity; we model availability by
    // counting active load, so no explicit BUSY enum needed here.
  });

  return { agentId: agent.id, agentCode: agent.code };
}

/** Failed-delivery recovery: capture a new date, reset for re-assignment. */
export async function rescheduleOrder(opts: {
  orderId: string;
  actor: AuthUser;
  rescheduleFor: string;
  note?: string;
}) {
  const [order] = await db.select().from(orders).where(eq(orders.id, opts.orderId)).limit(1);
  if (!order) throw new LifecycleError("Order not found");
  if (order.status !== "FAILED") {
    throw new LifecycleError("Only FAILED orders can be rescheduled");
  }

  const when = new Date(opts.rescheduleFor);

  await db.transaction(async (tx) => {
    await tx
      .update(orders)
      .set({
        status: "RESCHEDULED",
        rescheduleFor: when,
        rescheduleCount: order.rescheduleCount + 1,
        failureReason: null,
        assignedAgentId: null, // a fresh agent is chosen for the new attempt
        assignedAt: null,
        updatedAt: new Date(),
      })
      .where(eq(orders.id, order.id));

    await tx.insert(trackingEvents).values({
      orderId: order.id,
      status: "RESCHEDULED",
      note: opts.note ?? `Rescheduled for ${when.toDateString()} by ${opts.actor.name}`,
      actorUserId: opts.actor.id,
      actorRole: opts.actor.role,
      actorName: opts.actor.name,
      meta: { attempt: order.rescheduleCount + 1, rescheduleFor: when.toISOString() },
    });

    const [customer] = await tx.select().from(users).where(eq(users.id, order.customerId)).limit(1);
    if (customer) {
      await notifyStatusChange({
        orderId: order.id,
        userId: customer.id,
        toEmail: customer.email,
        toPhone: customer.phone,
        orderCode: order.code,
        status: "RESCHEDULED",
        extra: { rescheduleFor: when.toISOString() },
      });
    }
  });

  // Immediately try to line up the next agent for the retry attempt.
  let reassigned: { agentId: string | null; agentCode: string | null } = { agentId: null, agentCode: null };
  try {
    reassigned = await assignAgentToOrder({ orderId: order.id, actor: opts.actor, auto: true });
  } catch {
    // No agent free right now — admin can assign later; order stays RESCHEDULED.
  }
  return { rescheduledFor: when.toISOString(), reassigned };
}
