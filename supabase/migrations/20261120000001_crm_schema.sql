-- =============================================================================
-- Salesforce Clone — CRM schema
-- Objects: profiles (users), accounts, contacts, leads, opportunities, products,
--          opportunity_line_items, cases, campaigns, campaign_members,
--          activities (tasks / calls / emails / meetings), notes
-- Security: RLS on every table. Org-wide "public read" sharing model:
--   every signed-in user can read every record; owners edit their own records;
--   managers/admins can edit everything; only admins change user roles.
-- =============================================================================

-- Private schema for helper / trigger functions (not exposed through the Data API)
create schema if not exists private;
grant usage on schema private to authenticated;

-- -----------------------------------------------------------------------------
-- Enums (picklists)
-- -----------------------------------------------------------------------------
create type public.user_role         as enum ('admin', 'manager', 'sales_rep', 'support_agent');
create type public.account_type      as enum ('prospect', 'customer', 'partner', 'competitor', 'other');
create type public.rating            as enum ('hot', 'warm', 'cold');
create type public.lead_source       as enum ('web', 'phone_inquiry', 'partner_referral', 'employee_referral', 'trade_show', 'advertisement', 'email_campaign', 'other');
create type public.lead_status       as enum ('new', 'working', 'nurturing', 'qualified', 'unqualified', 'converted');
create type public.opportunity_stage as enum ('prospecting', 'qualification', 'needs_analysis', 'proposal', 'negotiation', 'closed_won', 'closed_lost');
create type public.opportunity_type  as enum ('new_business', 'existing_business', 'renewal');
create type public.case_status       as enum ('new', 'working', 'escalated', 'closed');
create type public.case_priority     as enum ('low', 'medium', 'high', 'critical');
create type public.case_origin       as enum ('email', 'phone', 'web', 'chat');
create type public.campaign_type     as enum ('email', 'webinar', 'conference', 'advertisement', 'direct_mail', 'social', 'other');
create type public.campaign_status   as enum ('planned', 'in_progress', 'completed', 'aborted');
create type public.member_status     as enum ('sent', 'responded');
create type public.activity_type     as enum ('task', 'call', 'email', 'meeting');
create type public.activity_status   as enum ('not_started', 'in_progress', 'completed', 'deferred');
create type public.activity_priority as enum ('low', 'normal', 'high');

-- -----------------------------------------------------------------------------
-- Users
-- -----------------------------------------------------------------------------
create table public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  email       text not null,
  full_name   text,
  title       text,
  phone       text,
  avatar_url  text,
  role        public.user_role not null default 'sales_rep',
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- Helper functions (security definer so they can read profiles under RLS)
-- -----------------------------------------------------------------------------
create or replace function private.current_user_role()
returns public.user_role
language sql stable security definer set search_path = ''
as $$
  select role from public.profiles where id = (select auth.uid())
$$;

create or replace function private.is_admin()
returns boolean
language sql stable security definer set search_path = ''
as $$
  select coalesce((select role = 'admin' from public.profiles where id = (select auth.uid())), false)
$$;

create or replace function private.is_manager_or_admin()
returns boolean
language sql stable security definer set search_path = ''
as $$
  select coalesce((select role in ('admin', 'manager') from public.profiles where id = (select auth.uid())), false)
$$;

create or replace function private.set_updated_at()
returns trigger
language plpgsql set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- New auth user -> profile. The very first user becomes the admin.
create or replace function private.handle_new_user()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, email, full_name, role)
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(nullif(new.raw_user_meta_data ->> 'full_name', ''), split_part(coalesce(new.email, ''), '@', 1)),
    case when exists (select 1 from public.profiles) then 'sales_rep'::public.user_role
         else 'admin'::public.user_role end
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_user();

-- Only admins may change role / active flag (SQL editor & service role bypass: auth.uid() is null)
create or replace function private.protect_profile_admin_fields()
returns trigger
language plpgsql set search_path = ''
as $$
begin
  if (new.role is distinct from old.role or new.is_active is distinct from old.is_active)
     and (select auth.uid()) is not null
     and not private.is_admin() then
    raise exception 'Only administrators can change roles or deactivate users';
  end if;
  new.id := old.id;
  new.email := old.email;
  return new;
end;
$$;

create trigger profiles_protect_admin_fields before update on public.profiles
  for each row execute function private.protect_profile_admin_fields();

-- -----------------------------------------------------------------------------
-- Accounts
-- -----------------------------------------------------------------------------
create table public.accounts (
  id                  uuid primary key default gen_random_uuid(),
  name                text not null,
  account_number      text,
  type                public.account_type default 'prospect',
  industry            text,
  rating              public.rating,
  website             text,
  phone               text,
  annual_revenue      numeric(18, 2),
  employees           integer check (employees is null or employees >= 0),
  parent_account_id   uuid references public.accounts (id) on delete set null,
  billing_street      text,
  billing_city        text,
  billing_state       text,
  billing_postal_code text,
  billing_country     text,
  description         text,
  owner_id            uuid default auth.uid() references public.profiles (id) on delete set null,
  created_by          uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- Contacts
-- -----------------------------------------------------------------------------
create table public.contacts (
  id                  uuid primary key default gen_random_uuid(),
  account_id          uuid references public.accounts (id) on delete set null,
  salutation          text,
  first_name          text,
  last_name           text not null,
  title               text,
  department          text,
  email               text,
  phone               text,
  mobile              text,
  lead_source         public.lead_source,
  birthdate           date,
  reports_to_id       uuid references public.contacts (id) on delete set null,
  mailing_street      text,
  mailing_city        text,
  mailing_state       text,
  mailing_postal_code text,
  mailing_country     text,
  description         text,
  owner_id            uuid default auth.uid() references public.profiles (id) on delete set null,
  created_by          uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- Opportunities
-- -----------------------------------------------------------------------------
create table public.opportunities (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  account_id   uuid references public.accounts (id) on delete cascade,
  contact_id   uuid references public.contacts (id) on delete set null,
  stage        public.opportunity_stage not null default 'prospecting',
  amount       numeric(18, 2),
  probability  integer check (probability is null or probability between 0 and 100),
  close_date   date not null default (current_date + 30),
  type         public.opportunity_type,
  lead_source  public.lead_source,
  next_step    text,
  description  text,
  closed_at    timestamptz,
  owner_id     uuid default auth.uid() references public.profiles (id) on delete set null,
  created_by   uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create or replace function private.stage_probability(s public.opportunity_stage)
returns integer
language sql immutable set search_path = ''
as $$
  select case s
    when 'prospecting'    then 10
    when 'qualification'  then 20
    when 'needs_analysis' then 40
    when 'proposal'       then 60
    when 'negotiation'    then 80
    when 'closed_won'     then 100
    else 0
  end
$$;

create or replace function private.opportunity_defaults()
returns trigger
language plpgsql set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    if new.probability is null then
      new.probability := private.stage_probability(new.stage);
    end if;
  elsif new.stage is distinct from old.stage and new.probability is not distinct from old.probability then
    new.probability := private.stage_probability(new.stage);
  end if;

  if new.stage in ('closed_won', 'closed_lost') then
    if tg_op = 'INSERT' or old.stage not in ('closed_won', 'closed_lost') then
      new.closed_at := now();
    end if;
  else
    new.closed_at := null;
  end if;
  return new;
end;
$$;

create trigger opportunities_defaults before insert or update on public.opportunities
  for each row execute function private.opportunity_defaults();

-- -----------------------------------------------------------------------------
-- Leads
-- -----------------------------------------------------------------------------
create table public.leads (
  id                       uuid primary key default gen_random_uuid(),
  salutation               text,
  first_name               text,
  last_name                text not null,
  company                  text not null,
  title                    text,
  email                    text,
  phone                    text,
  mobile                   text,
  website                  text,
  status                   public.lead_status not null default 'new',
  rating                   public.rating,
  lead_source              public.lead_source,
  industry                 text,
  annual_revenue           numeric(18, 2),
  employees                integer check (employees is null or employees >= 0),
  street                   text,
  city                     text,
  state                    text,
  postal_code              text,
  country                  text,
  description              text,
  converted_at             timestamptz,
  converted_account_id     uuid references public.accounts (id) on delete set null,
  converted_contact_id     uuid references public.contacts (id) on delete set null,
  converted_opportunity_id uuid references public.opportunities (id) on delete set null,
  owner_id                 uuid default auth.uid() references public.profiles (id) on delete set null,
  created_by               uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- Products & opportunity line items
-- -----------------------------------------------------------------------------
create table public.products (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  product_code text unique,
  family       text,
  description  text,
  unit_price   numeric(18, 2) not null default 0 check (unit_price >= 0),
  is_active    boolean not null default true,
  created_by   uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create table public.opportunity_line_items (
  id             uuid primary key default gen_random_uuid(),
  opportunity_id uuid not null references public.opportunities (id) on delete cascade,
  product_id     uuid not null references public.products (id) on delete restrict,
  quantity       numeric(12, 2) not null default 1 check (quantity > 0),
  unit_price     numeric(18, 2) not null check (unit_price >= 0),
  discount       numeric(5, 2) not null default 0 check (discount between 0 and 100),
  total_price    numeric(18, 2) generated always as (round(quantity * unit_price * (1 - discount / 100), 2)) stored,
  description    text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

-- Opportunity.amount = sum of line items (like Salesforce when products are attached)
create or replace function private.rollup_opportunity_amount()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_opp uuid;
begin
  if tg_op = 'DELETE' then
    v_opp := old.opportunity_id;
  else
    v_opp := new.opportunity_id;
  end if;

  update public.opportunities o
     set amount = (select coalesce(sum(li.total_price), 0)
                     from public.opportunity_line_items li
                    where li.opportunity_id = v_opp)
   where o.id = v_opp;

  if tg_op = 'UPDATE' and old.opportunity_id <> new.opportunity_id then
    update public.opportunities o
       set amount = (select coalesce(sum(li.total_price), 0)
                       from public.opportunity_line_items li
                      where li.opportunity_id = old.opportunity_id)
     where o.id = old.opportunity_id;
  end if;
  return null;
end;
$$;

create trigger line_items_rollup after insert or update or delete on public.opportunity_line_items
  for each row execute function private.rollup_opportunity_amount();

-- -----------------------------------------------------------------------------
-- Cases (customer service)
-- -----------------------------------------------------------------------------
create table public.cases (
  id          uuid primary key default gen_random_uuid(),
  case_number bigint generated always as identity (start with 1001) unique,
  subject     text not null,
  description text,
  status      public.case_status not null default 'new',
  priority    public.case_priority not null default 'medium',
  origin      public.case_origin,
  type        text,
  account_id  uuid references public.accounts (id) on delete set null,
  contact_id  uuid references public.contacts (id) on delete set null,
  closed_at   timestamptz,
  owner_id    uuid default auth.uid() references public.profiles (id) on delete set null,
  created_by  uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create or replace function private.case_closed_at()
returns trigger
language plpgsql set search_path = ''
as $$
begin
  if new.status = 'closed' then
    if tg_op = 'INSERT' or old.status <> 'closed' then
      new.closed_at := now();
    end if;
  else
    new.closed_at := null;
  end if;
  return new;
end;
$$;

create trigger cases_closed_at before insert or update on public.cases
  for each row execute function private.case_closed_at();

-- -----------------------------------------------------------------------------
-- Campaigns
-- -----------------------------------------------------------------------------
create table public.campaigns (
  id               uuid primary key default gen_random_uuid(),
  name             text not null,
  type             public.campaign_type,
  status           public.campaign_status not null default 'planned',
  start_date       date,
  end_date         date,
  budgeted_cost    numeric(18, 2),
  actual_cost      numeric(18, 2),
  expected_revenue numeric(18, 2),
  description      text,
  is_active        boolean not null default true,
  owner_id         uuid default auth.uid() references public.profiles (id) on delete set null,
  created_by       uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  check (end_date is null or start_date is null or end_date >= start_date)
);

create table public.campaign_members (
  id          uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns (id) on delete cascade,
  lead_id     uuid references public.leads (id) on delete cascade,
  contact_id  uuid references public.contacts (id) on delete cascade,
  status      public.member_status not null default 'sent',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  check (num_nonnulls(lead_id, contact_id) = 1),
  unique (campaign_id, lead_id),
  unique (campaign_id, contact_id)
);

-- -----------------------------------------------------------------------------
-- Activities (tasks, calls, emails, meetings) & notes — attach to any record
-- -----------------------------------------------------------------------------
create table public.activities (
  id             uuid primary key default gen_random_uuid(),
  type           public.activity_type not null default 'task',
  subject        text not null,
  status         public.activity_status not null default 'not_started',
  priority       public.activity_priority not null default 'normal',
  due_date       date,
  start_at       timestamptz,
  end_at         timestamptz,
  location       text,
  description    text,
  account_id     uuid references public.accounts (id) on delete cascade,
  contact_id     uuid references public.contacts (id) on delete cascade,
  lead_id        uuid references public.leads (id) on delete cascade,
  opportunity_id uuid references public.opportunities (id) on delete cascade,
  case_id        uuid references public.cases (id) on delete cascade,
  completed_at   timestamptz,
  owner_id       uuid default auth.uid() references public.profiles (id) on delete set null,
  created_by     uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  check (end_at is null or start_at is null or end_at >= start_at)
);

create or replace function private.activity_completed_at()
returns trigger
language plpgsql set search_path = ''
as $$
begin
  if new.status = 'completed' then
    if tg_op = 'INSERT' or old.status <> 'completed' then
      new.completed_at := now();
    end if;
  else
    new.completed_at := null;
  end if;
  return new;
end;
$$;

create trigger activities_completed_at before insert or update on public.activities
  for each row execute function private.activity_completed_at();

create table public.notes (
  id             uuid primary key default gen_random_uuid(),
  title          text,
  body           text not null,
  account_id     uuid references public.accounts (id) on delete cascade,
  contact_id     uuid references public.contacts (id) on delete cascade,
  lead_id        uuid references public.leads (id) on delete cascade,
  opportunity_id uuid references public.opportunities (id) on delete cascade,
  case_id        uuid references public.cases (id) on delete cascade,
  created_by     uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- updated_at triggers
-- -----------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['profiles','accounts','contacts','leads','opportunities','products',
                           'opportunity_line_items','cases','campaigns','campaign_members','activities','notes']
  loop
    execute format('create trigger %1$s_updated_at before update on public.%1$I
                    for each row execute function private.set_updated_at()', t);
  end loop;
end $$;

-- -----------------------------------------------------------------------------
-- Indexes (foreign keys + common filters)
-- -----------------------------------------------------------------------------
create index on public.accounts (owner_id);
create index on public.accounts (parent_account_id);
create index on public.accounts (created_by);
create index on public.accounts (lower(name));
create index on public.contacts (account_id);
create index on public.contacts (owner_id);
create index on public.contacts (created_by);
create index on public.contacts (reports_to_id);
create index on public.contacts (lower(last_name));
create index on public.leads (owner_id);
create index on public.leads (created_by);
create index on public.leads (status);
create index on public.leads (converted_account_id);
create index on public.leads (converted_contact_id);
create index on public.leads (converted_opportunity_id);
create index on public.opportunities (account_id);
create index on public.opportunities (contact_id);
create index on public.opportunities (owner_id);
create index on public.opportunities (created_by);
create index on public.opportunities (stage, close_date);
create index on public.products (created_by);
create index on public.opportunity_line_items (opportunity_id);
create index on public.opportunity_line_items (product_id);
create index on public.cases (account_id);
create index on public.cases (contact_id);
create index on public.cases (owner_id);
create index on public.cases (created_by);
create index on public.cases (status);
create index on public.campaigns (owner_id);
create index on public.campaigns (created_by);
create index on public.campaign_members (campaign_id);
create index on public.campaign_members (lead_id);
create index on public.campaign_members (contact_id);
create index on public.activities (account_id);
create index on public.activities (contact_id);
create index on public.activities (lead_id);
create index on public.activities (opportunity_id);
create index on public.activities (case_id);
create index on public.activities (owner_id, status, due_date);
create index on public.activities (created_by);
create index on public.notes (account_id);
create index on public.notes (contact_id);
create index on public.notes (lead_id);
create index on public.notes (opportunity_id);
create index on public.notes (case_id);
create index on public.notes (created_by);

-- -----------------------------------------------------------------------------
-- Row Level Security
-- -----------------------------------------------------------------------------
alter table public.profiles               enable row level security;
alter table public.products               enable row level security;
alter table public.opportunity_line_items enable row level security;
alter table public.campaign_members       enable row level security;
alter table public.notes                  enable row level security;

-- Profiles: everyone signed in can see the user directory; you edit yourself, admins edit anyone
create policy profiles_select on public.profiles for select to authenticated using (true);
create policy profiles_update on public.profiles for update to authenticated
  using (id = (select auth.uid()) or (select private.is_admin()))
  with check (id = (select auth.uid()) or (select private.is_admin()));

-- Owned business objects
do $$
declare t text;
begin
  foreach t in array array['accounts','contacts','leads','opportunities','cases','campaigns','activities']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy %1$s_select on public.%1$I for select to authenticated using (true)', t);
    execute format('create policy %1$s_insert on public.%1$I for insert to authenticated
                    with check (owner_id = (select auth.uid()) or (select private.is_manager_or_admin()))', t);
    -- owners may transfer ownership, hence the open with-check for signed-in users
    execute format('create policy %1$s_update on public.%1$I for update to authenticated
                    using (owner_id = (select auth.uid()) or (select private.is_manager_or_admin()))
                    with check ((select auth.uid()) is not null)', t);
    execute format('create policy %1$s_delete on public.%1$I for delete to authenticated
                    using (owner_id = (select auth.uid()) or (select private.is_manager_or_admin()))', t);
  end loop;
end $$;

-- Products: readable by all, maintained by managers/admins
create policy products_select on public.products for select to authenticated using (true);
create policy products_insert on public.products for insert to authenticated with check ((select private.is_manager_or_admin()));
create policy products_update on public.products for update to authenticated
  using ((select private.is_manager_or_admin())) with check ((select private.is_manager_or_admin()));
create policy products_delete on public.products for delete to authenticated using ((select private.is_manager_or_admin()));

-- Line items follow the parent opportunity
create policy oli_select on public.opportunity_line_items for select to authenticated using (true);
create policy oli_insert on public.opportunity_line_items for insert to authenticated with check (
  exists (select 1 from public.opportunities o where o.id = opportunity_id
          and (o.owner_id = (select auth.uid()) or (select private.is_manager_or_admin()))));
create policy oli_update on public.opportunity_line_items for update to authenticated using (
  exists (select 1 from public.opportunities o where o.id = opportunity_id
          and (o.owner_id = (select auth.uid()) or (select private.is_manager_or_admin()))));
create policy oli_delete on public.opportunity_line_items for delete to authenticated using (
  exists (select 1 from public.opportunities o where o.id = opportunity_id
          and (o.owner_id = (select auth.uid()) or (select private.is_manager_or_admin()))));

-- Campaign members follow the parent campaign
create policy cm_select on public.campaign_members for select to authenticated using (true);
create policy cm_insert on public.campaign_members for insert to authenticated with check (
  exists (select 1 from public.campaigns c where c.id = campaign_id
          and (c.owner_id = (select auth.uid()) or (select private.is_manager_or_admin()))));
create policy cm_update on public.campaign_members for update to authenticated using (
  exists (select 1 from public.campaigns c where c.id = campaign_id
          and (c.owner_id = (select auth.uid()) or (select private.is_manager_or_admin()))));
create policy cm_delete on public.campaign_members for delete to authenticated using (
  exists (select 1 from public.campaigns c where c.id = campaign_id
          and (c.owner_id = (select auth.uid()) or (select private.is_manager_or_admin()))));

-- Notes: anyone can add, authors (or managers) edit/delete
create policy notes_select on public.notes for select to authenticated using (true);
create policy notes_insert on public.notes for insert to authenticated with check (created_by = (select auth.uid()));
create policy notes_update on public.notes for update to authenticated
  using (created_by = (select auth.uid()) or (select private.is_manager_or_admin()))
  with check (created_by = (select auth.uid()) or (select private.is_manager_or_admin()));
create policy notes_delete on public.notes for delete to authenticated
  using (created_by = (select auth.uid()) or (select private.is_manager_or_admin()));

-- -----------------------------------------------------------------------------
-- Grants: only signed-in users reach CRM data through the API
-- -----------------------------------------------------------------------------
revoke all on all tables in schema public from anon;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant usage, select on all sequences in schema public to authenticated;
