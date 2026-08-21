/**
 * Seeds the platform network — NO user accounts.
 *
 *   • 4 zones, 12 pincode areas
 *   • full B2B + B2C rate matrices (intra + inter zone)
 *   • COD surcharges per order type
 *
 * Accounts are created through Better Auth (/auth/sign-up/email); agents are
 * provisioned by an admin via POST /admin/agents. Re-running this seed wipes
 * and rebuilds only network/pricing data — auth tables are left untouched.
 */
import { db, sql as client } from "./index";
import {
  areas,
  codSurcharges,
  rateCards,
  zones,
} from "./schema";

async function main() {
  console.log("Seeding network…");
  await db.delete(rateCards);
  await db.delete(codSurcharges);
  await db.delete(areas);
  await db.delete(zones);

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
  void areaRows;

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

  console.log("✅ Network seed complete (4 zones · 12 areas · 32 rate cards · 2 COD rules)");
}

main()
  .then(() => client.end())
  .catch(async (e) => {
    console.error(e);
    await client.end();
    process.exit(1);
  });
