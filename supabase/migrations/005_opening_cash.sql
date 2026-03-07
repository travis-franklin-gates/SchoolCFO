-- Add opening cash balance to schools table
ALTER TABLE schools ADD COLUMN IF NOT EXISTS opening_cash_balance numeric DEFAULT 0;
