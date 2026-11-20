# Salesforce Clone

A Salesforce-style CRM built with **Next.js 15 (App Router)** and **Supabase** (Postgres, Auth, Row Level Security), ready to deploy on **Vercel**.

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fshermainelee-lab%2Fsalesforce-clone&env=NEXT_PUBLIC_SUPABASE_URL,NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,APP_TIMEZONE&envDescription=Supabase%20project%20URL%20and%20publishable%20key%20(see%20.env.example))

## Features

| Area | What you get |
| --- | --- |
| **Sales** | Leads, Accounts, Contacts, Opportunities with products (line items), Campaigns & members |
| **Service** | Cases with auto-numbering (#1001…), priority, origin, closed-date tracking |
| **Record pages** | Highlights panel, clickable **Path** (stage/status bar), details by section, related lists, activity timeline, notes |
| **Lead conversion** | Convert to new/existing Account + Contact + optional Opportunity; activities, notes and campaign history carry over |
| **Pipeline** | Kanban board — drag deals between stages; probability auto-updates from stage |
| **Home** | KPIs (open & weighted pipeline, closed-won QTD, win rate, open leads/cases), pipeline by stage, my tasks, deals closing soon |
| **List views** | All / Mine, search, sortable columns, pagination, filter by any lookup (`/contacts?account_id=…`) |
| **Global search** | Across accounts, contacts, leads, opportunities, cases, campaigns, products |
| **Users & roles** | `admin`, `manager`, `sales_rep`, `support_agent`; the first sign-up becomes admin; admins manage roles under *Setup · Users* |
| **Demo data** | One click on an empty Home page loads sample records owned by you |

Everything is **metadata-driven**: `lib/objects.ts` defines each object's fields, list columns, highlights, path and related lists — the generic `[object]` routes render list, detail, new and edit pages from it (like Salesforce's Object Manager). Add a column in Supabase plus a `FieldDef`, and it appears everywhere.

## Database schema (Supabase)

Migrations live in [`supabase/migrations`](supabase/migrations) and are already applied to the Supabase project **`salesforce-clone`** (ref `qupsqbdzuiiyblwqhjbp`, region `ap-southeast-1`).

```
auth.users ──1:1── profiles (role, title, is_active)
                       │ owner_id / created_by on every business table
accounts ──< contacts            accounts ──< accounts (parent_account_id)
accounts ──< opportunities >── contacts (primary contact)
opportunities ──< opportunity_line_items >── products
accounts / contacts ──< cases
campaigns ──< campaign_members >── leads | contacts
leads ── converted_account_id / converted_contact_id / converted_opportunity_id
activities, notes ──> account | contact | lead | opportunity | case
```

| Table | Notes |
| --- | --- |
| `profiles` | One row per auth user (trigger on `auth.users`). First user → `admin`. Only admins can change `role` / `is_active`. |
| `accounts` | Type, industry, rating, revenue, employees, billing address, parent account |
| `contacts` | Account, reports-to, lead source, mailing address |
| `leads` | Status (`new → working → nurturing → qualified → converted`, or `unqualified`), rating, conversion links |
| `opportunities` | Stage enum, amount, probability (defaults from stage), close date, `closed_at` set automatically |
| `products`, `opportunity_line_items` | Catalog + line items; `total_price` is a generated column; opportunity `amount` is rolled up by trigger |
| `cases` | Identity `case_number`, status/priority/origin enums, `closed_at` set automatically |
| `campaigns`, `campaign_members` | Budget/revenue, members are a lead **or** a contact (check constraint) |
| `activities` | Tasks, calls, emails, meetings; `completed_at` set automatically |
| `notes` | Free-text notes on any record |

**RPC functions:** `convert_lead(...)`, `dashboard_summary()`, `seed_demo_data()` — all `SECURITY INVOKER`, so RLS applies.

**Security model (RLS on every table)** — mirrors Salesforce's "Public Read Only" org-wide default:
- every signed-in user can **read** all CRM records;
- record **owners** can edit/delete their records (and transfer ownership);
- **managers/admins** can edit/delete everything and maintain the product catalog;
- line items and campaign members inherit access from their parent;
- notes can be edited/deleted by their author (or managers);
- the `anon` role has no table access. Helper functions live in a non-exposed `private` schema.

## Run locally

```bash
cp .env.example .env.local   # already points at the Supabase project
npm install
npm run dev                   # http://localhost:3000
```

Sign up — the first account becomes the admin — then click **Load sample data** on Home.

## Deploy to Vercel

1. Import this repo in Vercel (or use the button above). Framework preset: **Next.js** (auto-detected; `vercel.json` pins the Singapore region next to the database).
2. Add environment variables (Production + Preview):
   - `NEXT_PUBLIC_SUPABASE_URL` = `https://qupsqbdzuiiyblwqhjbp.supabase.co`
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` = the publishable key from `.env.example` (safe to expose; RLS protects data)
   - optional `APP_TIMEZONE` (e.g. `Asia/Singapore`) and `APP_CURRENCY` (default `USD`)
3. Deploy.
4. In **Supabase → Authentication → URL Configuration**, set **Site URL** to your Vercel URL and add `https://<your-app>.vercel.app/auth/callback` (and `http://localhost:3000/auth/callback`) to **Redirect URLs**, so email-confirmation links come back to the app.

> Supabase's built-in email sender only delivers to your Supabase team members and is rate-limited. To invite other users, configure custom SMTP (Authentication → Emails) or turn off "Confirm email" while testing.

## Project structure

```
app/
  login/                 sign in / sign up (server actions)
  auth/callback, signout route handlers
  (crm)/layout.tsx       header, global search, app tabs
  (crm)/page.tsx         Home dashboard
  (crm)/[object]/        generic list, new, record, edit pages (+ leads/[id]/convert)
  (crm)/pipeline/        drag-and-drop opportunity board
  (crm)/search/          global search
components/              RecordForm, FieldValue, Path, related lists, activity panel, line items, campaign members
lib/objects.ts           object & field metadata
lib/actions.ts           server actions (CRUD, path, activities, notes, line items, conversion)
lib/supabase/            server + middleware clients (@supabase/ssr)
middleware.ts            session refresh + auth gate
supabase/migrations/     schema, RLS, triggers, RPCs, product seed
```

Regenerate typed definitions any time with `npm run gen:types` (needs the Supabase CLI and `supabase login`).
