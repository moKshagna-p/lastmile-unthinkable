import { z } from "zod";

// ── Enums ───────────────────────────────────────────────────────────────────
export const ROLES = ["CUSTOMER", "AGENT", "ADMIN"] as const;
export type Role = (typeof ROLES)[number];

export const ORDER_TYPES = ["B2B", "B2C"] as const;
export type OrderType = (typeof ORDER_TYPES)[number];

export const PAYMENT_TYPES = ["PREPAID", "COD"] as const;
export type PaymentType = (typeof PAYMENT_TYPES)[number];

export const ORDER_STATUSES = [
  "PLACED",
  "ASSIGNED",
  "PICKED_UP",
  "IN_TRANSIT",
  "OUT_FOR_DELIVERY",
  "DELIVERED",
  "FAILED",
  "RESCHEDULED",
  "CANCELLED",
] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const AGENT_STATUSES = ["AVAILABLE", "OFFLINE"] as const;
export type AgentStatus = (typeof AGENT_STATUSES)[number];

/**
 * Allowed status transitions. The lifecycle is:
 *
 *   PLACED ──► ASSIGNED ──► PICKED_UP ──► IN_TRANSIT ──► OUT_FOR_DELIVERY
 *                                                            │
 *                                    ┌───────────────────────┤
 *                                    ▼                       ▼
 *                                DELIVERED                 FAILED ──► RESCHEDULED ──► ASSIGNED (new attempt)
 *
 * Any state ──► CANCELLED (admin only, before pickup).
 */
export const STATUS_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  PLACED: ["ASSIGNED", "CANCELLED"],
  ASSIGNED: ["PICKED_UP", "FAILED", "CANCELLED"],
  PICKED_UP: ["IN_TRANSIT", "FAILED"],
  IN_TRANSIT: ["OUT_FOR_DELIVERY", "FAILED"],
  OUT_FOR_DELIVERY: ["DELIVERED", "FAILED"],
  FAILED: ["RESCHEDULED"],
  RESCHEDULED: ["ASSIGNED", "CANCELLED"],
  DELIVERED: [],
  CANCELLED: [],
};

export const STATUS_LABELS: Record<OrderStatus, string> = {
  PLACED: "Placed",
  ASSIGNED: "Agent Assigned",
  PICKED_UP: "Picked Up",
  IN_TRANSIT: "In Transit",
  OUT_FOR_DELIVERY: "Out for Delivery",
  DELIVERED: "Delivered",
  FAILED: "Delivery Failed",
  RESCHEDULED: "Rescheduled",
  CANCELLED: "Cancelled",
};

/** Statuses where the order is actively moving through the network. */
export const ACTIVE_STATUSES: OrderStatus[] = [
  "ASSIGNED",
  "PICKED_UP",
  "IN_TRANSIT",
  "OUT_FOR_DELIVERY",
  "RESCHEDULED",
];

export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  return STATUS_TRANSITIONS[from]?.includes(to) ?? false;
}

// ── Shared field schemas ────────────────────────────────────────────────────
const phone = z.string().min(8).max(20).regex(/^[+\d][\d\s-]+$/, "Invalid phone number");
const uuid = z.string().uuid();

export const addressSchema = z.object({
  contactName: z.string().min(2).max(120),
  contactPhone: phone,
  line1: z.string().min(5).max(300),
  areaId: uuid,
});
export type AddressInput = z.infer<typeof addressSchema>;

export const registerSchema = z.object({
  name: z.string().min(2).max(120),
  email: z.string().email(),
  phone,
  password: z.string().min(8).max(100),
});
export type RegisterInput = z.infer<typeof registerSchema>;

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const quoteSchema = z.object({
  pickupAreaId: uuid,
  dropAreaId: uuid,
  lengthCm: z.number().positive().max(300),
  breadthCm: z.number().positive().max(300),
  heightCm: z.number().positive().max(300),
  actualWeightKg: z.number().positive().max(500),
  orderType: z.enum(ORDER_TYPES),
  paymentType: z.enum(PAYMENT_TYPES),
  codAmount: z.number().nonnegative().optional(),
});
export type QuoteInput = z.infer<typeof quoteSchema>;

export const createOrderSchema = quoteSchema.extend({
  pickup: addressSchema,
  drop: addressSchema,
}).refine((v) => v.paymentType !== "COD" || (v.codAmount ?? 0) > 0, {
  message: "COD orders must include a COD amount",
  path: ["codAmount"],
});
export type CreateOrderInput = z.infer<typeof createOrderSchema>;

export const rescheduleSchema = z.object({
  rescheduleFor: z.string().datetime().or(z.string().date()),
  note: z.string().max(500).optional(),
});

export const statusUpdateSchema = z.object({
  status: z.enum(ORDER_STATUSES),
  note: z.string().max(500).optional(),
  /** Agent location at time of scan — used for live tracking. */
  lat: z.number().min(-90).max(90).optional(),
  lng: z.number().min(-180).max(180).optional(),
});

export const assignAgentSchema = z.object({
  agentId: uuid.optional(),
  auto: z.boolean().optional(),
});

export const zoneSchema = z.object({
  name: z.string().min(2).max(80),
  code: z.string().min(1).max(12).toUpperCase(),
  description: z.string().max(300).optional(),
});

export const areaSchema = z.object({
  name: z.string().min(2).max(120),
  pincode: z.string().regex(/^\d{6}$/, "Pincode must be 6 digits"),
  city: z.string().min(2).max(80),
  zoneId: uuid,
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});

export const rateCardSchema = z.object({
  fromZoneId: uuid,
  toZoneId: uuid,
  orderType: z.enum(ORDER_TYPES),
  baseWeightKg: z.number().positive().default(0.5),
  basePrice: z.number().nonnegative(),
  perKgRate: z.number().nonnegative(),
  active: z.boolean().default(true),
});

export const codSurchargeSchema = z.object({
  orderType: z.enum(ORDER_TYPES),
  percent: z.number().nonnegative().max(100),
  flatFee: z.number().nonnegative(),
  active: z.boolean().default(true),
});

export const agentProfileSchema = z.object({
  userId: uuid,
  code: z.string().min(2).max(20),
  vehicle: z.string().max(60).optional(),
  zoneId: uuid.nullable().optional(),
  capacity: z.number().int().min(1).max(50).default(3),
  currentLat: z.number().min(-90).max(90),
  currentLng: z.number().min(-180).max(180),
});

export const agentLocationSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});

export const agentStatusSchema = z.object({
  status: z.enum(AGENT_STATUSES),
});

// ── Pricing types ───────────────────────────────────────────────────────────
export interface ChargeBreakdown {
  volumetricWeightKg: number;
  billableWeightKg: number;
  appliedRateCardId: string | null;
  rateCardName: string | null;
  basePrice: number;
  chargeableWeightKg: number;
  perKgRate: number;
  freightCharge: number;
  codSurcharge: number;
  totalCharge: number;
  currency: string;
}

export interface ZonePairInfo {
  pickupZoneId: string;
  pickupZoneName: string;
  dropZoneId: string;
  dropZoneName: string;
  intraZone: boolean;
}
