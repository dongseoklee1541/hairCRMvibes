-- Manual rollback reference for R-09.
-- Review before use. The migration is additive and stores no data.

revoke all on function public.get_stats_summary(date, date) from public;
revoke all on function public.get_stats_summary(date, date) from anon;
revoke all on function public.get_stats_summary(date, date) from authenticated;
drop function if exists public.get_stats_summary(date, date);
