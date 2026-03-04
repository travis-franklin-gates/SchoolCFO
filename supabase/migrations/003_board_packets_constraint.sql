-- Add unique constraint on (school_id, month_key) so that upsert with
-- onConflict: 'school_id,month_key' works correctly for board_packets.
-- The saveBoardPacket action uses an update-then-insert pattern as a
-- belt-and-suspenders fallback, but this constraint is required for any
-- future upsert calls and enforces data integrity at the DB level.

ALTER TABLE board_packets
  ADD CONSTRAINT board_packets_school_month_unique
  UNIQUE (school_id, month_key);
