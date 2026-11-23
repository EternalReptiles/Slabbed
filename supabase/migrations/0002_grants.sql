-- New Supabase projects don't grant table access to app users automatically.
-- Row-level security (0001) still limits each person to their own rows.
grant select, insert, update, delete on public.binder_items to authenticated;
grant select, insert on public.scan_log to authenticated;
