import Link from "next/link";
import { requireUser } from "@/lib/supabase/server";
import { getField, OBJECTS, titleCase } from "@/lib/objects";
import { formatCurrency, formatDate } from "@/lib/format";
import { seedDemoData } from "@/lib/actions";
import { ObjectIcon } from "@/components/ObjectIcon";
import { ErrorAlert, param } from "@/components/Alert";
import { SubmitButton } from "@/components/SubmitButton";

export const metadata = { title: "Home" };

type SP = Promise<Record<string, string | string[] | undefined>>;
type Row = Record<string, unknown>;
type Summary = {
  open_pipeline: number;
  weighted_pipeline: number;
  won_this_quarter: number;
  open_opportunities: number;
  win_rate: number;
  open_leads: number;
  open_cases: number;
  accounts: number;
  pipeline_by_stage: { stage: string; count: number; amount: number }[];
  leads_by_status: { status: string; count: number }[];
  cases_by_priority: { priority: string; count: number }[];
};

function Kpi({ label, value, hint, href }: { label: string; value: string; hint?: string; href: string }) {
  return (
    <Link href={href} className="card block px-4 py-3 hover:border-brand">
      <p className="text-xs text-muted">{label}</p>
      <p className="mt-1 text-2xl font-bold">{value}</p>
      {hint && <p className="text-xs text-muted">{hint}</p>}
    </Link>
  );
}

function Bars({ rows, max, color }: { rows: { label: string; value: number; text: string }[]; max: number; color: string }) {
  if (rows.length === 0) return <p className="py-6 text-center text-sm text-muted">No data yet.</p>;
  return (
    <ul className="space-y-2">
      {rows.map((r) => (
        <li key={r.label} className="grid grid-cols-[120px_1fr_auto] items-center gap-3 text-sm">
          <span className="truncate text-muted">{r.label}</span>
          <span className="h-5 overflow-hidden rounded bg-gray-100">
            <span
              className="block h-full rounded"
              style={{ width: `${max > 0 ? Math.max(2, (r.value / max) * 100) : 0}%`, backgroundColor: color }}
            />
          </span>
          <span className="w-24 text-right font-medium tabular-nums">{r.text}</span>
        </li>
      ))}
    </ul>
  );
}

export default async function HomePage({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const { supabase, user, profile } = await requireUser();

  const [{ data: summaryData, error }, { data: tasksData }, { data: closingData }] = await Promise.all([
    supabase.rpc("dashboard_summary"),
    supabase
      .from("activities")
      .select("id, subject, type, due_date, priority")
      .eq("owner_id", user.id)
      .neq("status", "completed")
      .order("due_date", { ascending: true, nullsFirst: false })
      .limit(8),
    supabase
      .from("opportunities")
      .select("id, name, amount, close_date, stage, account:accounts!opportunities_account_id_fkey(name)")
      .not("stage", "in", "(closed_won,closed_lost)")
      .order("close_date", { ascending: true })
      .limit(6),
  ]);

  const s = (summaryData ?? null) as unknown as Summary | null;
  const tasks = (tasksData ?? []) as unknown as Row[];
  const closing = (closingData ?? []) as unknown as Row[];
  const statusField = getField(OBJECTS.leads, "status")!;
  const today = new Date().toISOString().slice(0, 10);
  const firstName = (profile?.full_name ?? "").split(" ")[0];

  const openStages = (s?.pipeline_by_stage ?? []).filter((p) => !p.stage.startsWith("closed"));
  const maxStage = Math.max(0, ...openStages.map((p) => Number(p.amount)));
  const maxLeads = Math.max(0, ...(s?.leads_by_status ?? []).map((l) => Number(l.count)));

  return (
    <div className="space-y-4">
      <ErrorAlert message={param(sp.error) ?? error?.message} />

      <div className="flex items-end justify-between">
        <div>
          <p className="text-sm text-muted">{formatDate(today)}</p>
          <h1 className="text-2xl font-bold">Welcome{firstName ? `, ${firstName}` : ""}</h1>
        </div>
        <div className="flex gap-2">
          <Link href="/leads/new" className="btn-neutral">
            New Lead
          </Link>
          <Link href="/opportunities/new" className="btn-primary">
            New Opportunity
          </Link>
        </div>
      </div>

      {s && s.accounts === 0 && (
        <div className="card flex flex-wrap items-center justify-between gap-3 border-brand bg-brand-light/40 px-4 py-3">
          <div>
            <p className="font-semibold">Your org is empty</p>
            <p className="text-sm text-muted">
              Load sample accounts, contacts, leads, opportunities, cases and a campaign (owned by you) to explore the app.
            </p>
          </div>
          <form action={seedDemoData}>
            <SubmitButton pendingText="Loading…">Load sample data</SubmitButton>
          </form>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
        <Kpi label="Open Pipeline" value={formatCurrency(s?.open_pipeline ?? 0, true)} hint={`${s?.open_opportunities ?? 0} open deals`} href="/pipeline" />
        <Kpi label="Weighted Pipeline" value={formatCurrency(s?.weighted_pipeline ?? 0, true)} hint="amount × probability" href="/pipeline" />
        <Kpi label="Closed Won (QTD)" value={formatCurrency(s?.won_this_quarter ?? 0, true)} href="/opportunities?sort=close_date&dir=desc" />
        <Kpi label="Win Rate" value={`${s?.win_rate ?? 0}%`} hint="won ÷ closed" href="/opportunities" />
        <Kpi label="Open Leads" value={String(s?.open_leads ?? 0)} href="/leads" />
        <Kpi label="Open Cases" value={String(s?.open_cases ?? 0)} href="/cases" />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <section className="card lg:col-span-2">
          <div className="card-header">
            <h2 className="card-title">Pipeline by Stage</h2>
            <Link href="/pipeline" className="link text-sm">
              Open board
            </Link>
          </div>
          <div className="p-4">
            <Bars
              color="#0176d3"
              max={maxStage}
              rows={openStages.map((p) => ({
                label: `${titleCase(p.stage)} (${p.count})`,
                value: Number(p.amount),
                text: formatCurrency(p.amount, true),
              }))}
            />
          </div>
        </section>

        <section className="card">
          <div className="card-header">
            <h2 className="card-title">My Open Tasks</h2>
            <Link href="/activities?view=mine" className="link text-sm">
              View all
            </Link>
          </div>
          {tasks.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-muted">Nothing due. Nice!</p>
          ) : (
            <ul className="divide-y divide-line">
              {tasks.map((t) => {
                const overdue = t.due_date && String(t.due_date) < today;
                return (
                  <li key={String(t.id)} className="flex items-center gap-3 px-4 py-2">
                    <ObjectIcon def={OBJECTS.activities} size="sm" />
                    <div className="min-w-0 flex-1">
                      <Link href={`/activities/${String(t.id)}`} className="link block truncate text-sm">
                        {String(t.subject)}
                      </Link>
                      <p className={`text-xs ${overdue ? "font-semibold text-red-700" : "text-muted"}`}>
                        {titleCase(String(t.type))}
                        {t.due_date ? ` · ${overdue ? "Overdue · " : ""}${formatDate(t.due_date)}` : ""}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section className="card lg:col-span-2">
          <div className="card-header">
            <h2 className="card-title">Deals Closing Soon</h2>
            <Link href="/opportunities" className="link text-sm">
              View all
            </Link>
          </div>
          {closing.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-muted">No open opportunities.</p>
          ) : (
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  <th className="th">Opportunity</th>
                  <th className="th">Account</th>
                  <th className="th">Stage</th>
                  <th className="th text-right">Amount</th>
                  <th className="th">Close Date</th>
                </tr>
              </thead>
              <tbody>
                {closing.map((o) => (
                  <tr key={String(o.id)}>
                    <td className="td">
                      <Link className="link" href={`/opportunities/${String(o.id)}`}>
                        {String(o.name)}
                      </Link>
                    </td>
                    <td className="td">{(o.account as { name?: string } | null)?.name ?? ""}</td>
                    <td className="td">{titleCase(String(o.stage))}</td>
                    <td className="td text-right tabular-nums">{formatCurrency(o.amount)}</td>
                    <td className={`td ${String(o.close_date) < today ? "font-semibold text-red-700" : ""}`}>
                      {formatDate(o.close_date)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        <section className="card">
          <div className="card-header">
            <h2 className="card-title">Leads by Status</h2>
          </div>
          <div className="p-4">
            <Bars
              color="#f88962"
              max={maxLeads}
              rows={(s?.leads_by_status ?? []).map((l) => ({
                label: statusField.options?.find((o) => o.value === l.status)?.label ?? l.status,
                value: Number(l.count),
                text: String(l.count),
              }))}
            />
          </div>
          {s && s.cases_by_priority.length > 0 && (
            <div className="border-t border-line px-4 py-3">
              <p className="mb-2 text-xs font-semibold tracking-wide text-muted uppercase">Open cases by priority</p>
              <div className="flex flex-wrap gap-2">
                {s.cases_by_priority.map((c) => (
                  <span key={c.priority} className="rounded bg-gray-100 px-2 py-1 text-xs">
                    {titleCase(c.priority)}: <strong>{c.count}</strong>
                  </span>
                ))}
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
