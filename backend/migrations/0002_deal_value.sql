-- A closed deal records its value, so sales commissions can be worked out.
-- Run once in the Supabase SQL editor.
alter table call_outcomes
  add column if not exists deal_value_usd numeric(12,2),
  add column if not exists deal_type text;

alter table call_outcomes drop constraint if exists call_outcomes_deal_check;
alter table call_outcomes add constraint call_outcomes_deal_check check (
  (outcome <> 'deal_closed')
  or (deal_value_usd is not null and deal_value_usd > 0 and deal_type in ('cash', 'in_kind'))
);
