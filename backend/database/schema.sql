-- Supabase / PostgreSQL schema. Apply in a new project or adapt table names to your existing database.
create extension if not exists pgcrypto;

create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  address text,
  created_at timestamptz not null default now()
);

create table if not exists public.maintenance_reports (
  id uuid primary key default gen_random_uuid(),
  report_no text unique,
  customer_id uuid references public.customers(id),
  customer_name text not null,
  contract_no text,
  maintenance_type text not null check (maintenance_type in ('quarterly','annual','both')),
  date_from text,
  date_to text,
  service_center text,
  address text,
  hotline text,
  ap_hotline text,
  content text,
  conclusion text,
  general_suggestion text,
  report_by text,
  witness_by text,
  status text not null default 'draft' check (status in ('draft','submitted','approved','returned')),
  form_payload jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.report_equipment (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references public.maintenance_reports(id) on delete cascade,
  unit_name text not null,
  model text,
  serial_number text,
  oil_quantity text,
  comments text,
  suggestion text,
  sort_order integer not null default 0
);

create table if not exists public.report_readings (
  id uuid primary key default gen_random_uuid(),
  equipment_id uuid not null references public.report_equipment(id) on delete cascade,
  parameter_key text not null,
  parameter_label text not null,
  unit text,
  reference_range text,
  reading_index integer not null default 1,
  reading_time text,
  reading_value text,
  created_at timestamptz not null default now()
);

create table if not exists public.report_checklist_items (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references public.maintenance_reports(id) on delete cascade,
  checklist_type text not null check (checklist_type in ('quarterly','annual')),
  item_key text not null,
  item_label text not null,
  is_completed boolean not null default false,
  remarks text
);

create table if not exists public.report_photos (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references public.maintenance_reports(id) on delete cascade,
  storage_path text not null,
  file_name text,
  caption text,
  sort_order integer not null default 0
);

create table if not exists public.generated_documents (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references public.maintenance_reports(id) on delete cascade,
  file_path text not null,
  file_name text not null,
  template_version text,
  generated_by uuid references auth.users(id),
  generated_at timestamptz not null default now()
);

create index if not exists idx_reports_customer on public.maintenance_reports(customer_id);
create index if not exists idx_reports_created on public.maintenance_reports(created_at desc);
create index if not exists idx_equipment_report on public.report_equipment(report_id);
create index if not exists idx_readings_equipment on public.report_readings(equipment_id);

-- Enable RLS. Policies below allow authenticated users to work only with reports they created.
-- For a multi-role production system, replace this with organization/team membership policies.
alter table public.customers enable row level security;
alter table public.maintenance_reports enable row level security;
alter table public.report_equipment enable row level security;
alter table public.report_readings enable row level security;
alter table public.report_checklist_items enable row level security;
alter table public.report_photos enable row level security;
alter table public.generated_documents enable row level security;

drop policy if exists "authenticated users can read customers" on public.customers;
create policy "authenticated users can read customers" on public.customers
for select to authenticated using (true);

drop policy if exists "authenticated users can manage own reports" on public.maintenance_reports;
create policy "authenticated users can manage own reports" on public.maintenance_reports
for all to authenticated
using (created_by = auth.uid())
with check (created_by = auth.uid());

drop policy if exists "equipment access through own report" on public.report_equipment;
create policy "equipment access through own report" on public.report_equipment
for all to authenticated
using (exists(select 1 from public.maintenance_reports r where r.id=report_id and r.created_by=auth.uid()))
with check (exists(select 1 from public.maintenance_reports r where r.id=report_id and r.created_by=auth.uid()));

drop policy if exists "readings access through own report" on public.report_readings;
create policy "readings access through own report" on public.report_readings
for all to authenticated
using (exists(select 1 from public.report_equipment e join public.maintenance_reports r on r.id=e.report_id where e.id=equipment_id and r.created_by=auth.uid()))
with check (exists(select 1 from public.report_equipment e join public.maintenance_reports r on r.id=e.report_id where e.id=equipment_id and r.created_by=auth.uid()));

drop policy if exists "checklist access through own report" on public.report_checklist_items;
create policy "checklist access through own report" on public.report_checklist_items
for all to authenticated
using (exists(select 1 from public.maintenance_reports r where r.id=report_id and r.created_by=auth.uid()))
with check (exists(select 1 from public.maintenance_reports r where r.id=report_id and r.created_by=auth.uid()));

drop policy if exists "photos access through own report" on public.report_photos;
create policy "photos access through own report" on public.report_photos
for all to authenticated
using (exists(select 1 from public.maintenance_reports r where r.id=report_id and r.created_by=auth.uid()))
with check (exists(select 1 from public.maintenance_reports r where r.id=report_id and r.created_by=auth.uid()));

drop policy if exists "documents access through own report" on public.generated_documents;
create policy "documents access through own report" on public.generated_documents
for all to authenticated
using (exists(select 1 from public.maintenance_reports r where r.id=report_id and r.created_by=auth.uid()))
with check (exists(select 1 from public.maintenance_reports r where r.id=report_id and r.created_by=auth.uid()));


-- Private photo bucket. Each user can access only files under their own user-id folder.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('report-photos', 'report-photos', false, 10485760, array['image/jpeg','image/png'])
on conflict (id) do update set public=false, file_size_limit=10485760, allowed_mime_types=array['image/jpeg','image/png'];

drop policy if exists "users upload own report photos" on storage.objects;
create policy "users upload own report photos" on storage.objects
for insert to authenticated with check (bucket_id='report-photos' and (storage.foldername(name))[1]=auth.uid()::text);

drop policy if exists "users read own report photos" on storage.objects;
create policy "users read own report photos" on storage.objects
for select to authenticated using (bucket_id='report-photos' and (storage.foldername(name))[1]=auth.uid()::text);

drop policy if exists "users update own report photos" on storage.objects;
create policy "users update own report photos" on storage.objects
for update to authenticated using (bucket_id='report-photos' and (storage.foldername(name))[1]=auth.uid()::text)
with check (bucket_id='report-photos' and (storage.foldername(name))[1]=auth.uid()::text);

drop policy if exists "users delete own report photos" on storage.objects;
create policy "users delete own report photos" on storage.objects
for delete to authenticated using (bucket_id='report-photos' and (storage.foldername(name))[1]=auth.uid()::text);

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;
drop trigger if exists set_maintenance_reports_updated_at on public.maintenance_reports;
create trigger set_maintenance_reports_updated_at before update on public.maintenance_reports
for each row execute function public.set_updated_at();
