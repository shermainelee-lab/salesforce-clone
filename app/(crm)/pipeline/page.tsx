import Link from "next/link";
import { requireUser } from "@/lib/supabase/server";
import { getField, OBJECTS } from "@/lib/objects";
import { formatCurrency } from "@/lib/format";
import { ObjectIcon } from "@/components/ObjectIcon";
import { param } from "@/components/Alert";
import { Board, type Card } from "./Board";

export const metadata = { title: "Pipeline" };

type SP = Promise<Record<string, string | string[] | undefined>>;
type Row = Record<string, unknown>;

export default async function PipelinePage({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const { supabase, user } = await requireUser();
  const mine = param(sp.view) === "mine";
  const def = OBJECTS.opportunities;
  const stageField = getField(def, "stage")!;

  // open deals + anything closed in the last 90 days
  const since = new Date(Date.now() - 90 * 86400000).toISOString();
  let q = supabase
    .from("opportunities")
    .select("id, name, amount, close_date, stage, closed_at, account:accounts!opportunities_account_id_fkey(name)")
    .or(`closed_at.is.null,closed_at.gte."${since}"`)
    .order("close_date", { ascending: true })
    .limit(500);
  if (mine) q = q.eq("owner_id", user.id);
  const { data } = await q;
  const rows = (data ?? []) as unknown as Row[];

  const cards: Card[] = rows.map((r) => ({
    id: String(r.id),
    name: String(r.name),
    account: (r.account as { name?: string } | null)?.name ?? null,
    amount: r.amount == null ? null : Number(r.amount),
    closeDate: String(r.close_date),
    stage: String(r.stage),
  }));
  const open = cards.filter((c) => !c.stage.startsWith("closed"));
  const openTotal = open.reduce((s, c) => s + (c.amount ?? 0), 0);

  return (
    <div>
      <div className="card mb-4 flex flex-wrap items-center gap-3 px-4 py-3">
        <ObjectIcon def={def} size="lg" />
        <div className="mr-auto">
          <p className="text-xs text-muted">Opportunities</p>
          <h1 className="text-lg font-bold">{mine ? "My Pipeline" : "Pipeline"}</h1>
          <p className="text-xs text-muted">
            {open.length} open · {formatCurrency(openTotal)} · drag a card to change its stage
          </p>
        </div>
        <div className="flex overflow-hidden rounded border border-gray-300 text-sm">
          <Link href="/pipeline" className={`px-3 py-1.5 ${!mine ? "bg-brand text-white" : "bg-white text-brand"}`}>
            All
          </Link>
          <Link
            href="/pipeline?view=mine"
            className={`px-3 py-1.5 ${mine ? "bg-brand text-white" : "bg-white text-brand"}`}
          >
            Mine
          </Link>
        </div>
        <Link href="/opportunities/new" className="btn-primary">
          New
        </Link>
      </div>
      <Board key={mine ? "mine" : "all"} stages={stageField.options ?? []} initial={cards} />
    </div>
  );
}
