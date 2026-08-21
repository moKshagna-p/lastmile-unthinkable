import { and, eq } from "drizzle-orm";
import { db } from "../db";
import { areas, codSurcharges, rateCards, zones } from "../db/schema";
import type { ChargeBreakdown, OrderType, PaymentType } from "@lastmile/shared";

export class PricingError extends Error {
  status: number;
  constructor(message: string, status = 422) {
    super(message);
    this.status = status;
  }
}

export const VOLUMETRIC_DIVISOR = 5000; // industry standard: L×B×H (cm³) ÷ 5000 = kg

/** Volumetric weight in kg from cm dimensions. */
export function volumetricWeight(l: number, b: number, h: number): number {
  return round2((l * b * h) / VOLUMETRIC_DIVISOR);
}

/**
 * Billable weight is the higher of actual vs volumetric, rounded UP to the
 * next 0.5 kg slab (carriers never bill fractional slabs downwards).
 */
export function billableWeight(actualKg: number, volKg: number): number {
  const higher = Math.max(actualKg, volKg);
  return Math.ceil(higher * 2) / 2;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export interface QuoteParams {
  pickupAreaId: string;
  dropAreaId: string;
  lengthCm: number;
  breadthCm: number;
  heightCm: number;
  actualWeightKg: number;
  orderType: OrderType;
  paymentType: PaymentType;
  codAmount?: number;
}

export interface QuoteResult extends ChargeBreakdown {
  pickupZoneId: string;
  dropZoneId: string;
  pickupZoneName: string;
  dropZoneName: string;
  intraZone: boolean;
}

/**
 * Rate calculation engine.
 *
 * 1. Zone detection — resolve both pincodes/areas to their configured zones.
 * 2. Volumetric weight — L×B×H ÷ 5000.
 * 3. Billable weight — max(actual, volumetric), rounded up to a 0.5 kg slab.
 * 4. Rate lookup — active rate card for (pickup zone → drop zone, order type).
 *    Intra-zone rates are simply cards where fromZone == toZone; inter-zone
 *    cards cover every other pair. Nothing is hardcoded: no card ⇒ explicit
 *    pricing error surfaced to the admin UI.
 * 5. Freight — base price covers `baseWeightKg`; everything above is charged
 *    at the per-kg rate.
 * 6. COD surcharge — percent of COD amount + flat fee, per order type,
 *    only when payment type is COD.
 */
export async function quote(params: QuoteParams): Promise<QuoteResult> {
  const [pickupArea] = await db.select().from(areas).where(eq(areas.id, params.pickupAreaId)).limit(1);
  const [dropArea] = await db.select().from(areas).where(eq(areas.id, params.dropAreaId)).limit(1);
  if (!pickupArea) throw new PricingError("Unknown pickup area");
  if (!dropArea) throw new PricingError("Unknown drop area");

  const [pickupZone] = await db.select().from(zones).where(eq(zones.id, pickupArea.zoneId)).limit(1);
  const [dropZone] = await db.select().from(zones).where(eq(zones.id, dropArea.zoneId)).limit(1);
  if (!pickupZone || !dropZone) throw new PricingError("Zone configuration missing for an area");

  const volKg = volumetricWeight(params.lengthCm, params.breadthCm, params.heightCm);
  const billedKg = billableWeight(params.actualWeightKg, volKg);

  const [card] = await db
    .select()
    .from(rateCards)
    .where(
      and(
        eq(rateCards.fromZoneId, pickupZone.id),
        eq(rateCards.toZoneId, dropZone.id),
        eq(rateCards.orderType, params.orderType),
        eq(rateCards.active, true),
      ),
    )
    .limit(1);

  if (!card) {
    throw new PricingError(
      `No active ${params.orderType} rate card configured for ${pickupZone.name} → ${dropZone.name}. Ask an admin to add one.`,
    );
  }

  const chargeableKg = Math.max(0, billedKg - card.baseWeightKg);
  const freight = round2(card.basePrice + chargeableKg * card.perKgRate);

  let codSurcharge = 0;
  if (params.paymentType === "COD") {
    const [surcharge] = await db
      .select()
      .from(codSurcharges)
      .where(and(eq(codSurcharges.orderType, params.orderType), eq(codSurcharges.active, true)))
      .limit(1);
    if (!surcharge) {
      throw new PricingError(`No active COD surcharge configured for ${params.orderType} orders.`);
    }
    codSurcharge = round2(((params.codAmount ?? 0) * surcharge.percent) / 100 + surcharge.flatFee);
  }

  return {
    pickupZoneId: pickupZone.id,
    dropZoneId: dropZone.id,
    pickupZoneName: pickupZone.name,
    dropZoneName: dropZone.name,
    intraZone: pickupZone.id === dropZone.id,
    volumetricWeightKg: volKg,
    billableWeightKg: billedKg,
    appliedRateCardId: card.id,
    rateCardName: card.name,
    basePrice: card.basePrice,
    chargeableWeightKg: round2(chargeableKg),
    perKgRate: card.perKgRate,
    freightCharge: freight,
    codSurcharge,
    totalCharge: round2(freight + codSurcharge),
    currency: "INR",
  };
}
