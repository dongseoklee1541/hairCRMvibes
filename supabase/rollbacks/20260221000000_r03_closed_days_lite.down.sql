revoke all on function public.remove_closed_day_range(date, date) from authenticated;
drop function if exists public.remove_closed_day_range(date, date);

revoke all on function public.apply_closed_days_batch_with_cancellations(text, date, date, int, text) from authenticated;
drop function if exists public.apply_closed_days_batch_with_cancellations(text, date, date, int, text);
