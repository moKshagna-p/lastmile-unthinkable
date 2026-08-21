/**
 * Seeds the platform with a realistic Bengaluru network:
 *   • 4 zones, 12 pincode areas
 *   • full B2B + B2C rate matrices (intra + inter zone)
 *   • COD surcharges per order type
 *   • admin / customer / agent demo accounts
 *   • sample orders across the lifecycle
 *
 * Idempotent: wipes domain tables first, then re-inserts.
 */
import { sql } from "drizzle-orm";
import { db, sql as client } from "./index";
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
} from "./schema";
import { hashPassword } from "../lib/auth";
import { quote } from "../lib/pricing";

const DEMO_PASSWORD = "Password@123";

async function main() {
  console.log("Seeding…");
  // Order matters for FKs; tracking_events trigger blocks deletes → disable it.
  await client.unsafe(`DROP TRIGGER IF EXISTS tracking_events_no_update ON tracking_events`);
  await db.delete(trackingEvents);
  await db.delete(notifications);
  await db.delete(orders);
  await db.delete(rateCards);
  await db.delete(codSurcharges);
  await db.delete(agents);
  await db.delete(users);
  await db.delete(areas);
  await db.delete(zones);
  await client.unsafe(`
    CREATE TRIGGER tracking_events_no_update
      BEFORE UPDATE OR DELETE ON tracking_events
      FOR EACH ROW EXECUTE FUNCTION forbid_tracking_mutation();
  `);

  const hash = await hashPassword(DEMO_PASSWORD);

  // ── Users ─────────────────────────────────────────────────────────────────
  const [admin] = await db.insert(users).values({
    name: "Aarav Admin", email: "admin@lastmile.dev", phone: "+919800000001",
    passwordHash: hash, role: "ADMIN",
  }).returning();

  const [customer] = await db.insert(users).values({
    name: "Riya Customer", email: "customer@lastmile.dev", phone: "+919800000002",
    passwordHash: hash, role: "CUSTOMER",
  }).returning();

  const [customer2] = await db.insert(users).values({
    name: "Karan Commerce", email: "karan@shopnow.dev", phone: "+919800000003",
    passwordHash: hash, role: "CUSTOMER",
  }).returning();

  const agentUsers = await db.insert(users).values([
    { name: "Vikram Rider", email: "vikram@lastmile.dev", phone: "+919800000011", passwordHash: hash, role: "AGENT" },
    { name: "Meera Rider", email: "meera@lastmile.dev", phone: "+919800000012", passwordHash: hash, role: "AGENT" },
    { name: "Arjun Rider", email: "arjun@lastmile.dev", phone: "+919800000013", passwordHash: hash, role: "AGENT" },
    { name: "Divya Rider", email: "divya@lastmile.dev", phone: "+919800000014", passwordHash: hash, role: "AGENT" },
  ]).returning();

  // ── Zones & areas ─────────────────────────────────────────────────────────
  const zoneRows = await db.insert(zones).values([
    { name: "Central Bengaluru", code: "CEN", description: "CBD and surrounding commercial core" },
    { name: "North Bengaluru", code: "NOR", description: "Hebbal–Yelahanka corridor incl. airport belt" },
    { name: "South Bengaluru", code: "SOU", description: "Jayanagar–BTM–Electronic City belt" },
    { name: "East Bengaluru", code: "EAS", description: "Whitefield–Marathahalli IT corridor" },
  ]).returning();
  const [cen, nor, sou, eas] = zoneRows;

  const areaRows = await db.insert(areas).values([
    { name: "MG Road", pincode: "560001", city: "Bengaluru", zoneId: cen.id, lat: 12.9756, lng: 77.6068 },
    { name: "Indiranagar", pincode: "560038", city: "Bengaluru", zoneId: cen.id, lat: 12.9784, lng: 77.6408 },
    { name: "Koramangala", pincode: "560034", city: "Bengaluru", zoneId: cen.id, lat: 12.9352, lng: 77.6245 },
    { name: "Hebbal", pincode: "560024", city: "Bengaluru", zoneId: nor.id, lat: 13.0358, lng: 77.5970 },
    { name: "Yelahanka", pincode: "560064", city: "Bengaluru", zoneId: nor.id, lat: 13.1007, lng: 77.5963 },
    { name: "Devanahalli", pincode: "562110", city: "Bengaluru", zoneId: nor.id, lat: 13.2437, lng: 77.7122 },
    { name: "Jayanagar", pincode: "560041", city: "Bengaluru", zoneId: sou.id, lat: 12.9250, lng: 77.5938 },
    { name: "BTM Layout", pincode: "560076", city: "Bengaluru", zoneId: sou.id, lat: 12.9166, lng: 77.6101 },
    { name: "Electronic City", pincode: "560100", city: "Bengaluru", zoneId: sou.id, lat: 12.8452, lng: 77.6602 },
    { name: "Whitefield", pincode: "560066", city: "Bengaluru", zoneId: eas.id, lat: 12.9698, lng: 77.7500 },
    { name: "Marathahalli", pincode: "560037", city: "Bengaluru", zoneId: eas.id, lat: 12.9569, lng: 77.7011 },
    { name: "KR Puram", pincode: "560036", city: "Bengaluru", zoneId: eas.id, lat: 13.0075, lng: 77.6957 },
  ]).returning();

  const areaByPin = Object.fromEntries(areaRows.map((a) => [a.pincode, a]));

  // ── Rate cards: every ordered zone pair × order type ──────────────────────
  const cards: (typeof rateCards.$inferInsert)[] = [];
  for (const from of zoneRows) {
    for (const to of zoneRows) {
      const intra = from.id === to.id;
      cards.push(
        { name: `${from.name} → ${to.name} · B2B`, fromZoneId: from.id, toZoneId: to.id, orderType: "B2B",
          baseWeightKg: intra ? 2 : 5, basePrice: intra ? 90 : 210, perKgRate: intra ? 18 : 26, active: true },
        { name: `${from.name} → ${to.name} · B2C`, fromZoneId: from.id, toZoneId: to.id, orderType: "B2C",
          baseWeightKg: 0.5, basePrice: intra ? 55 : 120, perKgRate: intra ? 30 : 42, active: true },
      );
    }
  }
  await db.insert(rateCards).values(cards);

  await db.insert(codSurcharges).values([
    { orderType: "B2B", percent: 1.5, flatFee: 45, active: true },
    { orderType: "B2C", percent: 2.5, flatFee: 25, active: true },
  ]);

  // ── Agents ────────────────────────────────────────────────────────────────
  const agentRows = await db.insert(agents).values([
    { userId: agentUsers[0].id, code: "AG-101", vehicle: "Honda Activa · KA-01", status: "AVAILABLE",
      capacity: 3, currentLat: 12.9719, currentLng: 77.6412, homeZoneId: cen.id },   // near Indiranagar
    { userId: agentUsers[1].id, code: "AG-102", vehicle: "TVS Jupiter · KA-05", status: "AVAILABLE",
      capacity: 3, currentLat: 13.0298, currentLng: 77.5966, homeZoneId: nor.id },   // near Hebbal
    { userId: agentUsers[2].id, code: "AG-103", vehicle: "Ather 450X · KA-51", status: "AVAILABLE",
      capacity: 2, currentLat: 12.9172, currentLng: 77.6229, homeZoneId: sou.id },   // near BTM
    { userId: agentUsers[3].id, code: "AG-104", vehicle: "Bajaj Pulsar · KA-03", status: "OFFLINE",
      capacity: 3, currentLat: 12.9698, currentLng: 77.7500, homeZoneId: eas.id },   // Whitefield, offline
  ]).returning();

  // ── Sample orders across the lifecycle ────────────────────────────────────
  async function makeOrder(opts: {
    customerId: string;
    pickupPin: string; dropPin: string;
    l: number; b: number; h: number; w: number;
    orderType: "B2B" | "B2C"; paymentType: "PREPAID" | "COD"; codAmount?: number;
    dropName?: string; dropPhone?: string;
  }) {
    const q = await quote({
      pickupAreaId: areaByPin[opts.pickupPin].id,
      dropAreaId: areaByPin[opts.dropPin].id,
      lengthCm: opts.l, breadthCm: opts.b, heightCm: opts.h,
      actualWeightKg: opts.w,
      orderType: opts.orderType, paymentType: opts.paymentType, codAmount: opts.codAmount,
    });
    return { q, pickup: areaByPin[opts.pickupPin], drop: areaByPin[opts.dropPin] };
  }

  let seq = 0;
  async function insertOrder(o: {
    customerId: string; status: any; assignedAgentId?: string | null;
    pickupPin: string; dropPin: string; l: number; b: number; h: number; w: number;
    orderType: "B2B" | "B2C"; paymentType: "PREPAID" | "COD"; codAmount?: number;
    failureReason?: string; rescheduleFor?: Date; dropName?: string; dropPhone?: string;
  }) {
    seq += 1;
    const { q, pickup, drop } = await makeOrder(o);
    const [order] = await db.insert(orders).values({
      code: `LM-2026-${String(seq).padStart(5, "0")}`,
      customerId: o.customerId, createdByUserId: o.customerId,
      status: o.status,
      pickupContactName: "Riya Customer", pickupContactPhone: "+919800000002",
      pickupLine1: `${12 + seq}, 5th Cross`, pickupAreaId: pickup.id,
      dropContactName: o.dropName ?? "Store Manager", dropContactPhone: o.dropPhone ?? "+919800000099",
      dropLine1: `Plot ${seq}, Industrial Layout`, dropAreaId: drop.id,
      lengthCm: o.l, breadthCm: o.b, heightCm: o.h, actualWeightKg: o.w,
      orderType: o.orderType, paymentType: o.paymentType, codAmount: o.codAmount ?? null,
      volumetricWeightKg: q.volumetricWeightKg, billableWeightKg: q.billableWeightKg,
      freightCharge: q.freightCharge, codSurcharge: q.codSurcharge, totalCharge: q.totalCharge,
      appliedRateCardId: q.appliedRateCardId, pickupZoneId: q.pickupZoneId, dropZoneId: q.dropZoneId,
      assignedAgentId: o.assignedAgentId ?? null,
      assignedAt: o.assignedAgentId ? new Date() : null,
      failureReason: o.failureReason ?? null,
      rescheduleFor: o.rescheduleFor ?? null,
    }).returning();

    const chain: Array<{ status: any; note: string }> = [{ status: "PLACED", note: "Order placed" }];
    if (o.assignedAgentId) chain.push({ status: "ASSIGNED", note: "Auto-assigned to nearest available agent" });
    if (["PICKED_UP", "IN_TRANSIT", "OUT_FOR_DELIVERY", "DELIVERED", "FAILED"].includes(o.status)) {
      chain.push({ status: "PICKED_UP", note: "Parcel collected from pickup point" });
    }
    if (["IN_TRANSIT", "OUT_FOR_DELIVERY", "DELIVERED", "FAILED"].includes(o.status)) {
      chain.push({ status: "IN_TRANSIT", note: "Moving through the network" });
    }
    if (["OUT_FOR_DELIVERY", "DELIVERED", "FAILED"].includes(o.status)) {
      chain.push({ status: "OUT_FOR_DELIVERY", note: "Out for final-mile delivery" });
    }
    if (o.status === "DELIVERED") chain.push({ status: "DELIVERED", note: "Delivered and signed" });
    if (o.status === "FAILED") chain.push({ status: "FAILED", note: o.failureReason ?? "Customer unavailable" });
    if (o.status === "RESCHEDULED") {
      chain.push({ status: "FAILED", note: o.failureReason ?? "Customer unavailable" });
      chain.push({ status: "RESCHEDULED", note: `Rescheduled for ${o.rescheduleFor?.toDateString()}` });
    }

    await db.insert(trackingEvents).values(
      chain.map((c, i) => ({
        orderId: order.id, status: c.status, note: c.note,
        actorUserId: admin.id, actorRole: "ADMIN" as const, actorName: "Seed Script",
        createdAt: new Date(Date.now() - (chain.length - i) * 3600_000),
      })),
    );
    return order;
  }

  await insertOrder({ customerId: customer.id, status: "PLACED", pickupPin: "560038", dropPin: "560064",
    l: 30, b: 20, h: 10, w: 2, orderType: "B2C", paymentType: "PREPAID" });
  await insertOrder({ customerId: customer.id, status: "OUT_FOR_DELIVERY", assignedAgentId: agentRows[0].id,
    pickupPin: "560001", dropPin: "560034", l: 25, b: 15, h: 8, w: 1.2, orderType: "B2C", paymentType: "COD", codAmount: 1499 });
  await insertOrder({ customerId: customer2.id, status: "IN_TRANSIT", assignedAgentId: agentRows[1].id,
    pickupPin: "560066", dropPin: "560100", l: 40, b: 40, h: 30, w: 8, orderType: "B2B", paymentType: "PREPAID" });
  await insertOrder({ customerId: customer.id, status: "FAILED", assignedAgentId: agentRows[2].id,
    pickupPin: "560076", dropPin: "560037", l: 35, b: 25, h: 12, w: 3, orderType: "B2C",
    paymentType: "COD", codAmount: 2999, failureReason: "Customer unreachable at drop address" });
  await insertOrder({ customerId: customer2.id, status: "DELIVERED", assignedAgentId: agentRows[0].id,
    pickupPin: "560034", dropPin: "560066", l: 50, b: 40, h: 35, w: 12, orderType: "B2B", paymentType: "PREPAID" });

  console.log("✅ Seed complete");
  console.log("   admin@lastmile.dev / Password@123  (ADMIN)");
  console.log("   customer@lastmile.dev / Password@123  (CUSTOMER)");
  console.log("   vikram@lastmile.dev / Password@123  (AGENT)");
}

main()
  .then(() => client.end())
  .catch(async (e) => {
    console.error(e);
    await client.end();
    process.exit(1);
  });
