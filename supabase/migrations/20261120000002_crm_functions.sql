-- =============================================================================
-- RPC functions: lead conversion, dashboard summary, demo data
-- All run as SECURITY INVOKER so Row Level Security still applies.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Convert a lead into an account (new or existing), contact and optional opportunity
-- -----------------------------------------------------------------------------
create or replace function public.convert_lead(
  p_lead_id            uuid,
  p_account_id         uuid    default null,
  p_create_opportunity boolean default true,
  p_opportunity_name   text    default null
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_lead    public.leads%rowtype;
  v_account uuid := p_account_id;
  v_contact uuid;
  v_opp     uuid;
begin
  if (select auth.uid()) is null then
    raise exception 'You must be signed in to convert a lead';
  end if;

  select * into v_lead from public.leads where id = p_lead_id for update;
  if not found then
    raise exception 'Lead not found';
  end if;
  if v_lead.status = 'converted' then
    raise exception 'Lead has already been converted';
  end if;

  if v_account is null then
    insert into public.accounts (name, industry, phone, website, annual_revenue, employees, rating,
                                 billing_street, billing_city, billing_state, billing_postal_code, billing_country,
                                 type, description)
    values (v_lead.company, v_lead.industry, v_lead.phone, v_lead.website, v_lead.annual_revenue, v_lead.employees,
            v_lead.rating, v_lead.street, v_lead.city, v_lead.state, v_lead.postal_code, v_lead.country,
            'prospect', v_lead.description)
    returning id into v_account;
  end if;

  insert into public.contacts (account_id, salutation, first_name, last_name, title, email, phone, mobile, lead_source,
                               mailing_street, mailing_city, mailing_state, mailing_postal_code, mailing_country)
  values (v_account, v_lead.salutation, v_lead.first_name, v_lead.last_name, v_lead.title, v_lead.email, v_lead.phone,
          v_lead.mobile, v_lead.lead_source, v_lead.street, v_lead.city, v_lead.state, v_lead.postal_code, v_lead.country)
  returning id into v_contact;

  if p_create_opportunity then
    insert into public.opportunities (name, account_id, contact_id, stage, close_date, lead_source, type)
    values (coalesce(nullif(trim(p_opportunity_name), ''), v_lead.company || ' - New Business'),
            v_account, v_contact, 'qualification', current_date + 30, v_lead.lead_source, 'new_business')
    returning id into v_opp;
  end if;

  -- carry the lead's history over to the new contact / account
  update public.activities set contact_id = v_contact, account_id = v_account,
                               opportunity_id = coalesce(opportunity_id, v_opp)
   where lead_id = p_lead_id;
  update public.notes set contact_id = v_contact, account_id = v_account
   where lead_id = p_lead_id;
  update public.campaign_members set contact_id = v_contact, lead_id = null
   where lead_id = p_lead_id
     and not exists (select 1 from public.campaign_members m2
                      where m2.campaign_id = campaign_members.campaign_id and m2.contact_id = v_contact);

  update public.leads
     set status = 'converted',
         converted_at = now(),
         converted_account_id = v_account,
         converted_contact_id = v_contact,
         converted_opportunity_id = v_opp
   where id = p_lead_id;

  return jsonb_build_object('account_id', v_account, 'contact_id', v_contact, 'opportunity_id', v_opp);
end;
$$;

-- -----------------------------------------------------------------------------
-- Home-page dashboard numbers in one round trip
-- -----------------------------------------------------------------------------
create or replace function public.dashboard_summary()
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select jsonb_build_object(
    'open_pipeline', (select coalesce(sum(amount), 0) from public.opportunities
                       where stage not in ('closed_won', 'closed_lost')),
    'weighted_pipeline', (select coalesce(sum(amount * probability / 100.0), 0) from public.opportunities
                           where stage not in ('closed_won', 'closed_lost')),
    'won_this_quarter', (select coalesce(sum(amount), 0) from public.opportunities
                          where stage = 'closed_won' and close_date >= date_trunc('quarter', current_date)::date),
    'open_opportunities', (select count(*) from public.opportunities
                            where stage not in ('closed_won', 'closed_lost')),
    'win_rate', (select case when count(*) filter (where stage in ('closed_won', 'closed_lost')) = 0 then 0
                        else round(100.0 * count(*) filter (where stage = 'closed_won')
                                   / count(*) filter (where stage in ('closed_won', 'closed_lost')), 1) end
                   from public.opportunities),
    'open_leads', (select count(*) from public.leads where status not in ('converted', 'unqualified')),
    'open_cases', (select count(*) from public.cases where status <> 'closed'),
    'accounts', (select count(*) from public.accounts),
    'pipeline_by_stage', (select coalesce(jsonb_agg(jsonb_build_object('stage', stage, 'count', c, 'amount', a)
                                                    order by stage), '[]'::jsonb)
                            from (select stage, count(*) c, coalesce(sum(amount), 0) a
                                    from public.opportunities group by stage) s),
    'leads_by_status', (select coalesce(jsonb_agg(jsonb_build_object('status', status, 'count', c)
                                                  order by status), '[]'::jsonb)
                          from (select status, count(*) c from public.leads group by status) s),
    'cases_by_priority', (select coalesce(jsonb_agg(jsonb_build_object('priority', priority, 'count', c)
                                                    order by priority), '[]'::jsonb)
                            from (select priority, count(*) c from public.cases
                                   where status <> 'closed' group by priority) s)
  )
$$;

-- -----------------------------------------------------------------------------
-- Product catalog seed (runs once, as the migration owner)
-- -----------------------------------------------------------------------------
insert into public.products (name, product_code, family, unit_price, description) values
  ('Sales Cloud – Starter',       'SC-START', 'Software', 25,    'Per user / month, core CRM'),
  ('Sales Cloud – Professional',  'SC-PRO',   'Software', 80,    'Per user / month, forecasting & quotes'),
  ('Sales Cloud – Enterprise',    'SC-ENT',   'Software', 165,   'Per user / month, advanced automation'),
  ('Service Cloud – Professional','SV-PRO',   'Software', 80,    'Per user / month, case management'),
  ('Implementation Package',      'PS-IMPL',  'Services', 15000, 'Fixed-fee onboarding & configuration'),
  ('Premier Support',             'SUP-PREM', 'Support',  5000,  'Annual 24/7 support plan'),
  ('Admin Training (2 days)',     'TRN-ADM',  'Training', 2400,  'Instructor-led, up to 10 attendees');

-- -----------------------------------------------------------------------------
-- Demo data, owned by the calling user (button on the empty Home page)
-- -----------------------------------------------------------------------------
create or replace function public.seed_demo_data()
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  a1 uuid; a2 uuid; a3 uuid; a4 uuid;
  c1 uuid; c2 uuid; c3 uuid; c4 uuid;
  o1 uuid; o2 uuid; o3 uuid;
  l1 uuid;
  cp uuid;
begin
  if (select auth.uid()) is null then
    raise exception 'You must be signed in';
  end if;

  insert into public.accounts (name, type, industry, rating, website, phone, annual_revenue, employees, billing_city, billing_country, description)
  values ('Acme Corporation', 'customer', 'Manufacturing', 'hot', 'https://acme.example.com', '+1 415 555 0100', 12500000, 450, 'San Francisco', 'United States', 'Long-time customer expanding into APAC.')
  returning id into a1;
  insert into public.accounts (name, type, industry, rating, website, phone, annual_revenue, employees, billing_city, billing_country)
  values ('Globex Asia Pte Ltd', 'prospect', 'Logistics', 'warm', 'https://globex.example.com', '+65 6555 0199', 48000000, 1200, 'Singapore', 'Singapore')
  returning id into a2;
  insert into public.accounts (name, type, industry, rating, website, phone, annual_revenue, employees, billing_city, billing_country)
  values ('Initech', 'customer', 'Technology', 'warm', 'https://initech.example.com', '+1 512 555 0142', 7300000, 210, 'Austin', 'United States')
  returning id into a3;
  insert into public.accounts (name, type, industry, rating, website, billing_city, billing_country, parent_account_id)
  values ('Acme Robotics', 'customer', 'Manufacturing', 'cold', 'https://robotics.acme.example.com', 'Penang', 'Malaysia', a1)
  returning id into a4;

  insert into public.contacts (account_id, first_name, last_name, title, email, phone, lead_source)
  values (a1, 'Maria', 'Gonzalez', 'VP Operations', 'maria.gonzalez@acme.example.com', '+1 415 555 0101', 'trade_show')
  returning id into c1;
  insert into public.contacts (account_id, first_name, last_name, title, email, phone, lead_source)
  values (a2, 'Wei Ming', 'Tan', 'Head of IT', 'weiming.tan@globex.example.com', '+65 6555 0123', 'web')
  returning id into c2;
  insert into public.contacts (account_id, first_name, last_name, title, email, phone, lead_source)
  values (a3, 'Peter', 'Gibbons', 'Engineering Manager', 'peter@initech.example.com', '+1 512 555 0143', 'partner_referral')
  returning id into c3;
  insert into public.contacts (account_id, first_name, last_name, title, email, reports_to_id)
  values (a1, 'James', 'Okafor', 'Procurement Lead', 'james.okafor@acme.example.com', c1)
  returning id into c4;

  insert into public.opportunities (name, account_id, contact_id, stage, close_date, type, lead_source, next_step)
  values ('Acme – APAC Expansion', a1, c1, 'proposal', current_date + 21, 'existing_business', 'trade_show', 'Send revised proposal')
  returning id into o1;
  insert into public.opportunities (name, account_id, contact_id, stage, amount, close_date, type, lead_source, next_step)
  values ('Globex – Service Cloud Rollout', a2, c2, 'qualification', 240000, current_date + 60, 'new_business', 'web', 'Discovery workshop')
  returning id into o2;
  insert into public.opportunities (name, account_id, contact_id, stage, amount, close_date, type)
  values ('Initech – Renewal FY27', a3, c3, 'negotiation', 96000, current_date + 10, 'renewal')
  returning id into o3;
  insert into public.opportunities (name, account_id, stage, amount, close_date, type)
  values ('Acme Robotics – Pilot', a4, 'closed_won', 32000, current_date - 5, 'new_business'),
         ('Initech – Analytics Add-on', a3, 'closed_lost', 18000, current_date - 12, 'existing_business'),
         ('Globex – Training', a2, 'prospecting', 12000, current_date + 90, 'new_business');

  insert into public.opportunity_line_items (opportunity_id, product_id, quantity, unit_price, discount)
  select o1, p.id, x.qty, p.unit_price, x.disc
    from (values ('SC-ENT', 120::numeric, 10::numeric), ('PS-IMPL', 1::numeric, 0::numeric), ('SUP-PREM', 1::numeric, 0::numeric)) as x(code, qty, disc)
    join public.products p on p.product_code = x.code;

  insert into public.leads (first_name, last_name, company, title, email, phone, status, rating, lead_source, industry, city, country)
  values ('Aisha', 'Rahman', 'Stark Logistics', 'COO', 'aisha@stark-logistics.example.com', '+60 3 5555 0177', 'working', 'hot', 'web', 'Logistics', 'Kuala Lumpur', 'Malaysia')
  returning id into l1;
  insert into public.leads (first_name, last_name, company, title, email, status, rating, lead_source, industry, city, country) values
    ('Daniel', 'Lim', 'Wayne Fintech', 'CTO', 'daniel.lim@waynefin.example.com', 'new', 'warm', 'trade_show', 'Financial Services', 'Singapore', 'Singapore'),
    ('Sofia', 'Rossi', 'Umbrella Health', 'Director of IT', 'sofia.rossi@umbrella.example.com', 'nurturing', 'cold', 'email_campaign', 'Healthcare', 'Milan', 'Italy'),
    ('Kenji', 'Watanabe', 'Cyberdyne KK', 'Head of Sales Ops', 'kenji@cyberdyne.example.com', 'qualified', 'hot', 'partner_referral', 'Technology', 'Tokyo', 'Japan');

  insert into public.cases (subject, description, status, priority, origin, account_id, contact_id) values
    ('Cannot export reports to CSV', 'Export button returns an error for large reports.', 'working', 'high', 'email', a1, c1),
    ('SSO login loop', 'Users are redirected repeatedly after SAML login.', 'escalated', 'critical', 'phone', a3, c3),
    ('Request: add custom field to Accounts', null, 'new', 'low', 'web', a2, c2);

  insert into public.campaigns (name, type, status, start_date, end_date, budgeted_cost, expected_revenue, description)
  values ('APAC Customer Summit 2026', 'conference', 'in_progress', current_date - 14, current_date + 30, 40000, 500000, 'Regional customer event in Singapore')
  returning id into cp;
  insert into public.campaign_members (campaign_id, contact_id, status) values (cp, c1, 'responded'), (cp, c2, 'sent');
  insert into public.campaign_members (campaign_id, lead_id, status) values (cp, l1, 'responded');

  insert into public.activities (type, subject, status, priority, due_date, account_id, contact_id, opportunity_id) values
    ('call',    'Pricing follow-up call', 'not_started', 'high',   current_date + 1, a1, c1, o1),
    ('task',    'Prepare discovery deck', 'in_progress', 'normal', current_date + 3, a2, c2, o2),
    ('email',   'Send renewal quote',     'completed',   'normal', current_date - 2, a3, c3, o3);
  insert into public.activities (type, subject, status, priority, due_date, lead_id) values
    ('meeting', 'Intro meeting with Stark Logistics', 'not_started', 'normal', current_date + 5, l1);

  insert into public.notes (title, body, account_id, opportunity_id)
  values ('Budget confirmed', 'Maria confirmed budget approval for FY27; decision expected by end of month.', a1, o1);
end;
$$;

-- Function privileges: callable by signed-in users only
revoke execute on function public.convert_lead(uuid, uuid, boolean, text) from public, anon;
revoke execute on function public.dashboard_summary() from public, anon;
revoke execute on function public.seed_demo_data() from public, anon;
grant execute on function public.convert_lead(uuid, uuid, boolean, text) to authenticated;
grant execute on function public.dashboard_summary() to authenticated;
grant execute on function public.seed_demo_data() to authenticated;
