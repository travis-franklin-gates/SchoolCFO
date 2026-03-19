alter table schools
  add column if not exists current_assets decimal default 0,
  add column if not exists current_liabilities decimal default 0,
  add column if not exists total_assets decimal default 0,
  add column if not exists total_liabilities decimal default 0,
  add column if not exists annual_depreciation decimal default 0,
  add column if not exists annual_debt_service decimal default 0,
  add column if not exists interest_expense decimal default 0;
