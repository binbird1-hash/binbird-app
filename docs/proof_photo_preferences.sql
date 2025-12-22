-- Table for storing per-property proof photo preferences used by admin/staff views
-- Adjust the property_id type/reference below to match your existing properties table (uuid/text).

create table if not exists public.proof_photo_preferences (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete cascade,
  job_type text not null check (job_type in ('put_out','bring_in')),
  parity text not null check (parity in ('odd','even')),
  photo_path text not null,
  created_at timestamptz not null default now(),
  unique (property_id, job_type, parity)
);

-- If you are not using the default auth schema, adjust the policy roles accordingly.
alter table public.proof_photo_preferences enable row level security;

-- Allow authenticated service role to manage preferences.
create policy if not exists "Allow service role full access" on public.proof_photo_preferences
  for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');

-- If application users need to read preferences, add a read policy that matches your auth model, e.g.:
-- create policy "Allow authenticated read" on public.proof_photo_preferences
--   for select using (auth.role() = 'authenticated');
