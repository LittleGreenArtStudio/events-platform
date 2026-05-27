create table estimates (
  id uuid primary key default uuid_generate_v4(),
  offsite_event_id uuid references offsite_events(id) on delete cascade,
  in_studio_event_id uuid references in_studio_events(id) on delete cascade,
  status text not null default 'draft',
  pricing_mode text not null default 'custom',
  per_guest_price numeric(10,2),
  materials_lines jsonb not null default '[]',
  staff_lines jsonb not null default '[]',
  travel_lines jsonb not null default '[]',
  addon_lines jsonb not null default '[]',
  materials_subtotal numeric(10,2) not null default 0,
  staff_subtotal numeric(10,2) not null default 0,
  travel_subtotal numeric(10,2) not null default 0,
  addon_subtotal numeric(10,2) not null default 0,
  total_cost numeric(10,2) not null default 0,
  markup_pct numeric(5,2) not null default 0,
  client_total numeric(10,2) not null default 0,
  tax_rate numeric(5,4) not null default 0,
  tax_amount numeric(10,2) not null default 0,
  deposit_pct numeric(5,2) not null default 50,
  deposit_amount numeric(10,2) not null default 0,
  balance_due numeric(10,2) not null default 0,
  client_notes text,
  sent_at timestamptz,
  accepted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (offsite_event_id is null) or (in_studio_event_id is null)
  )
);

alter table estimates enable row level security;

-- Adjust these policies to match your auth_role() setup.
-- If you use a custom auth_role() function, keep as-is.
-- If you use Supabase's built-in auth with user metadata, swap for your pattern.
create policy "admin_all_estimates" on estimates for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');
