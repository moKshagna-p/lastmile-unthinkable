/**
 * Generates DDL for the immutable tracking-events guard trigger.
 * Tracking history must never be mutated or removed once written.
 */
export function immutabilityTriggerDDL(): string[] {
  return [
    `CREATE OR REPLACE FUNCTION forbid_tracking_mutation() RETURNS trigger AS $$
     BEGIN
       RAISE EXCEPTION 'tracking_events is append-only: % not permitted', TG_OP;
     END;
     $$ LANGUAGE plpgsql;`,
    `DROP TRIGGER IF EXISTS tracking_events_no_update ON tracking_events;
     CREATE TRIGGER tracking_events_no_update
       BEFORE UPDATE OR DELETE ON tracking_events
       FOR EACH ROW EXECUTE FUNCTION forbid_tracking_mutation();`,
  ];
}
