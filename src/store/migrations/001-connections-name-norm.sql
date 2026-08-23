-- One-time migration for existing databases (schema.sql already has the column
-- for fresh installs): adds the canonical person-name key used by the
-- person-connections graph.
ALTER TABLE connections ADD COLUMN name_norm TEXT;
