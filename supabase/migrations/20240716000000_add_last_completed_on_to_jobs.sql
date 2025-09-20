alter table public.jobs
  add column if not exists last_completed_on date;

create index if not exists jobs_last_completed_on_idx
  on public.jobs (last_completed_on);

