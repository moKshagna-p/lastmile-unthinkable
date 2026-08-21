import {
  boolean,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import type { OrderStatus, OrderType, PaymentType, Role, AgentStatus } from "@lastmile/shared";

// ── Enums ───────────────────────────────────────────────────────────────────
export const roleEnum = pgEnum("role", ["CUSTOMER", "AGENT", "ADMIN"]);
export const orderTypeEnum = pgEnum("order_type", ["B2B", "B2C"]);
export const paymentTypeEnum = pgEnum("payment_type", ["PREPAID", "COD"]);
export const orderStatusEnum = pgEnum("order_status", [
  "PLACED",
  "ASSIGNED",
  "PICKED_UP",
  "IN_TRANSIT",
  "OUT_FOR_DELIVERY",
  "DELIVERED",
  "FAILED",
  "RESCHEDULED",
  "CANCELLED",
]);
export const agentStatusEnum = pgEnum("agent_status", ["AVAILABLE", "OFFLINE"]);
export const channelEnum = pgEnum("channel", ["EMAIL", "SMS"]);
export const notifStatusEnum = pgEnum("notif_status", ["QUEUED", "SENT", "FAILED"]);

// ── Users (Better Auth "user" model + domain fields) ───────────────────────
// Better Auth owns identity (id, credentials in `account`, sessions in
// `session`). `phone` and `role` are domain additionalFields; role is only
// settable server-side (admin agent creation), never from client sign-up.
export const users = pgTable("users", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text("image"),
  phone: text("phone").notNull(),
  role: roleEnum("role").notNull().default("CUSTOMER"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// ── Better Auth internals ───────────────────────────────────────────────────
export const sessions = pgTable(
  "session",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    token: text("token").notNull().unique(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("session_user_id_idx").on(t.userId)],
);

export const accounts = pgTable(
  "account",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    /** Provider URL for OAuth/OIDC credentials (unused for password auth). */
    issuer: text("issuer"),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at", { withTimezone: true }),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at", { withTimezone: true }),
    scope: text("scope"),
    /** Hashed password — only populated for the credential provider. */
    password: text("password"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("account_user_id_idx").on(t.userId)],
);

export const verifications = pgTable(
  "verification",
  {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("verification_identifier_idx").on(t.identifier)],
);

// ── Zones & areas (pincode → zone mapping) ─────────────────────────────────
export const zones = pgTable("zones", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  code: text("code").notNull().unique(),
  description: text("description"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/** A pincode maps to exactly one zone — this is the unit of zone detection. */
export const areas = pgTable(
  "areas",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    pincode: text("pincode").notNull().unique(),
    city: text("city").notNull(),
    zoneId: uuid("zone_id")
      .notNull()
      .references(() => zones.id),
    lat: doublePrecision("lat").notNull(),
    lng: doublePrecision("lng").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
);

// ── Rate cards & COD surcharge (all admin-configurable) ─────────────────────
export const rateCards = pgTable("rate_cards", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  fromZoneId: uuid("from_zone_id")
    .notNull()
    .references(() => zones.id),
  toZoneId: uuid("to_zone_id")
    .notNull()
    .references(() => zones.id),
  orderType: orderTypeEnum("order_type").notNull(),
  /** Weight included in the base price. */
  baseWeightKg: doublePrecision("base_weight_kg").notNull().default(0.5),
  basePrice: doublePrecision("base_price").notNull(),
  perKgRate: doublePrecision("per_kg_rate").notNull(),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
// Uniqueness of the *active* card per (fromZone, toZone, orderType) is enforced
// by the admin service layer: creating/activating a card supersedes the previous one.

export const codSurcharges = pgTable(
  "cod_surcharges",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orderType: orderTypeEnum("order_type").notNull().unique(),
    percent: doublePrecision("percent").notNull(),
    flatFee: doublePrecision("flat_fee").notNull(),
    active: boolean("active").notNull().default(true),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
);

// ── Agents ──────────────────────────────────────────────────────────────────
export const agents = pgTable("agents", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id")
    .notNull()
    .unique()
    .references(() => users.id),
  code: text("code").notNull().unique(),
  vehicle: text("vehicle"),
  status: agentStatusEnum("status").notNull().default("AVAILABLE"),
  /** Max concurrent active orders — models availability for auto-assignment. */
  capacity: integer("capacity").notNull().default(3),
  currentLat: doublePrecision("current_lat").notNull(),
  currentLng: doublePrecision("current_lng").notNull(),
  homeZoneId: uuid("home_zone_id").references(() => zones.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// ── Orders ──────────────────────────────────────────────────────────────────
export const orders = pgTable("orders", {
  id: uuid("id").primaryKey().defaultRandom(),
  code: text("code").notNull().unique(),

  customerId: text("customer_id")
    .notNull()
    .references(() => users.id),
  createdByUserId: text("created_by_user_id")
    .notNull()
    .references(() => users.id),

  status: orderStatusEnum("status").notNull().default("PLACED"),

  // Pickup
  pickupContactName: text("pickup_contact_name").notNull(),
  pickupContactPhone: text("pickup_contact_phone").notNull(),
  pickupLine1: text("pickup_line1").notNull(),
  pickupAreaId: uuid("pickup_area_id")
    .notNull()
    .references(() => areas.id),

  // Drop
  dropContactName: text("drop_contact_name").notNull(),
  dropContactPhone: text("drop_contact_phone").notNull(),
  dropLine1: text("drop_line1").notNull(),
  dropAreaId: uuid("drop_area_id")
    .notNull()
    .references(() => areas.id),

  // Package
  lengthCm: doublePrecision("length_cm").notNull(),
  breadthCm: doublePrecision("breadth_cm").notNull(),
  heightCm: doublePrecision("height_cm").notNull(),
  actualWeightKg: doublePrecision("actual_weight_kg").notNull(),

  // Commercial
  orderType: orderTypeEnum("order_type").notNull(),
  paymentType: paymentTypeEnum("payment_type").notNull(),
  codAmount: doublePrecision("cod_amount"),

  // Computed at creation by the pricing engine
  volumetricWeightKg: doublePrecision("volumetric_weight_kg").notNull(),
  billableWeightKg: doublePrecision("billable_weight_kg").notNull(),
  freightCharge: doublePrecision("freight_charge").notNull(),
  codSurcharge: doublePrecision("cod_surcharge").notNull().default(0),
  totalCharge: doublePrecision("total_charge").notNull(),
  appliedRateCardId: uuid("applied_rate_card_id").references(() => rateCards.id),
  pickupZoneId: uuid("pickup_zone_id")
    .notNull()
    .references(() => zones.id),
  dropZoneId: uuid("drop_zone_id")
    .notNull()
    .references(() => zones.id),

  // Assignment
  assignedAgentId: uuid("assigned_agent_id").references(() => agents.id),
  assignedAt: timestamp("assigned_at", { withTimezone: true }),

  // Failed-delivery flow
  failureReason: text("failure_reason"),
  rescheduleFor: timestamp("reschedule_for", { withTimezone: true }),
  rescheduleCount: integer("reschedule_count").notNull().default(0),

  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/**
 * Immutable audit trail. Rows are only ever INSERTed — updates and deletes are
 * additionally blocked by a database trigger (see src/db/migrate.ts).
 */
export const trackingEvents = pgTable("tracking_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  orderId: uuid("order_id")
    .notNull()
    .references(() => orders.id),
  status: orderStatusEnum("status").notNull(),
  note: text("note"),
  actorUserId: text("actor_user_id").references(() => users.id),
  actorRole: roleEnum("actor_role").notNull(),
  actorName: text("actor_name").notNull(),
  meta: jsonb("meta").$type<Record<string, unknown>>(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/** Outbox of every notification the platform attempted to deliver. */
export const notifications = pgTable("notifications", {
  id: uuid("id").primaryKey().defaultRandom(),
  orderId: uuid("order_id").references(() => orders.id),
  userId: text("user_id").references(() => users.id),
  channel: channelEnum("channel").notNull(),
  recipient: text("recipient").notNull(),
  subject: text("subject").notNull(),
  body: text("body").notNull(),
  status: notifStatusEnum("status").notNull().default("QUEUED"),
  provider: text("provider").notNull().default("console"),
  error: text("error"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// ── Relations ───────────────────────────────────────────────────────────────
export const zonesRelations = relations(zones, ({ many }) => ({
  areas: many(areas),
}));

export const areasRelations = relations(areas, ({ one }) => ({
  zone: one(zones, { fields: [areas.zoneId], references: [zones.id] }),
}));

export const agentsRelations = relations(agents, ({ one }) => ({
  user: one(users, { fields: [agents.userId], references: [users.id] }),
  homeZone: one(zones, { fields: [agents.homeZoneId], references: [zones.id] }),
}));

export const ordersRelations = relations(orders, ({ one, many }) => ({
  customer: one(users, { fields: [orders.customerId], references: [users.id] }),
  pickupArea: one(areas, { fields: [orders.pickupAreaId], references: [areas.id] }),
  dropArea: one(areas, { fields: [orders.dropAreaId], references: [areas.id] }),
  assignedAgent: one(agents, { fields: [orders.assignedAgentId], references: [agents.id] }),
  events: many(trackingEvents),
}));

export const trackingEventsRelations = relations(trackingEvents, ({ one }) => ({
  order: one(orders, { fields: [trackingEvents.orderId], references: [orders.id] }),
  actor: one(users, { fields: [trackingEvents.actorUserId], references: [users.id] }),
}));

// Convenience aliases for typed rows
export type User = typeof users.$inferSelect;
export type Zone = typeof zones.$inferSelect;
export type Area = typeof areas.$inferSelect;
export type Agent = typeof agents.$inferSelect;
export type RateCard = typeof rateCards.$inferSelect;
export type CodSurcharge = typeof codSurcharges.$inferSelect;
export type Order = typeof orders.$inferSelect;
export type TrackingEvent = typeof trackingEvents.$inferSelect;
export type Notification = typeof notifications.$inferSelect;
