-- Soft confirm gate: UI must approve before consume/execute can use confirmId
alter table plan_confirms
  add column if not exists approved_at timestamptz;
