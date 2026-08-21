import { and, count, eq, inArray } from "drizzle-orm";
import { db } from "../db";
import { agents, areas, orders } from "../db/schema";
import { haversineKm } from "./geo";
import { env } from "../env";
import { ACTIVE_STATUSES, type OrderStatus } from "@lastmile/shared";

export class AssignmentError extends Error {
  status = 409;
}

export interface AgentScore {
  agentId: string;
  agentCode: string;
  distanceKm: number;
  activeLoad: number;
  capacity: number;
  sameZone: boolean;
  score: number;
}

/**
 * Auto-assignment: pick the nearest AVAILABLE agent for a pickup area.
 *
 * Availability model — an agent is assignable when:
 *   • their profile status is AVAILABLE (not OFFLINE), and
 *   • their active load (orders in ASSIGNED / PICKED_UP / IN_TRANSIT /
 *     OUT_FOR_DELIVERY / RESCHEDULED) is below their `capacity`.
 *
 * Scoring — candidates are ranked by:
 *   1. hard radius filter: live distance to the pickup-area centroid must be
 *      within AGENT_MAX_RADIUS_KM,
 *   2. zone affinity bonus: agents whose home zone equals the pickup zone get
 *      a 30% effective-distance discount, so at equal physical distance the
 *      local agent wins,
 *   3. lowest effective distance wins; ties broken by lower active load.
 */
export async function findNearestAgent(pickupAreaId: string): Promise<AgentScore | null> {
  const [area] = await db.select().from(areas).where(eq(areas.id, pickupAreaId)).limit(1);
  if (!area) throw new AssignmentError("Pickup area not found");

  const availableAgents = await db.select().from(agents).where(eq(agents.status, "AVAILABLE"));
  if (availableAgents.length === 0) return null;

  // Active load per agent
  const loads = await db
    .select({ agentId: orders.assignedAgentId, n: count() })
    .from(orders)
    .where(and(inArray(orders.status, ACTIVE_STATUSES as [OrderStatus, ...OrderStatus[]])))
    .groupBy(orders.assignedAgentId);
  const loadMap = new Map(loads.map((l) => [l.agentId, Number(l.n)]));

  let best: AgentScore | null = null;
  for (const agent of availableAgents) {
    const activeLoad = loadMap.get(agent.id) ?? 0;
    if (activeLoad >= agent.capacity) continue;

    const distanceKm = haversineKm(agent.currentLat, agent.currentLng, area.lat, area.lng);
    if (distanceKm > env.agentMaxRadiusKm) continue;

    const sameZone = agent.homeZoneId === area.zoneId;
    const effectiveDistance = sameZone ? distanceKm * 0.7 : distanceKm;

    const candidate: AgentScore = {
      agentId: agent.id,
      agentCode: agent.code,
      distanceKm: Math.round(distanceKm * 10) / 10,
      activeLoad,
      capacity: agent.capacity,
      sameZone,
      score: effectiveDistance + activeLoad * 0.5, // mild penalty per active parcel
    };

    if (!best || candidate.score < best.score ||
        (candidate.score === best.score && candidate.activeLoad < best.activeLoad)) {
      best = candidate;
    }
  }
  return best;
}
