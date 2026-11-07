-- The audit trail is append-only. UPDATE/DELETE/TRUNCATE are rejected at database level,
-- so even a compromised application account cannot rewrite history.
-- Retention purges must be done by a DBA via a documented procedure (see docs/operations).
CREATE OR REPLACE FUNCTION audit_logs_block_mutation() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'audit_logs is append-only';
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER audit_logs_no_update BEFORE UPDATE OR DELETE ON audit_logs
  FOR EACH ROW EXECUTE FUNCTION audit_logs_block_mutation();
--> statement-breakpoint
CREATE TRIGGER audit_logs_no_truncate BEFORE TRUNCATE ON audit_logs
  FOR EACH STATEMENT EXECUTE FUNCTION audit_logs_block_mutation();
--> statement-breakpoint
-- Prevent cycles in the occupational hierarchy.
CREATE OR REPLACE FUNCTION occupations_prevent_cycle() RETURNS trigger AS $$
BEGIN
  IF NEW.parent_id IS NOT NULL AND EXISTS (
    WITH RECURSIVE ancestors(id) AS (
      SELECT NEW.parent_id
      UNION
      SELECT o.parent_id FROM occupations o JOIN ancestors a ON o.id = a.id WHERE o.parent_id IS NOT NULL
    )
    SELECT 1 FROM ancestors WHERE id = NEW.id
  ) THEN
    RAISE EXCEPTION 'occupation hierarchy cycle detected' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER occupations_cycle_check BEFORE INSERT OR UPDATE OF parent_id ON occupations
  FOR EACH ROW EXECUTE FUNCTION occupations_prevent_cycle();
