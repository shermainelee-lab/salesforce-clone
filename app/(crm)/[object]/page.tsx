import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/supabase/server";
import { getField, getObject, OBJECTS, recordHref, recordName, selectFor, type ObjectKey } from "@/lib/objects";
import { cleanSearch, orIlike, resolveSelfRefs } from "@/lib/data";
import { FieldValue } from "@/components/FieldValue";
import { ObjectIcon } from "@/components/ObjectIcon";
import { ErrorAlert, param } from "@/components/Alert";

const PAGE_SIZE = 25;

type Params = Promise<{ object: string }>;
type SP = Promise<Record<string, string | string[] | undefined>>;
type Row = Record<string, unknown>;

export async function generateMetadata({ params }: { params: Params }) {
  const def = getObject((await params).object);
  return { title: def?.plural ?? "Not found" };
}

export default async function ListView({ params, searchParams }: { params: Params; searchParams: SP }) {
  const def = getObject((await params).object);
  if (!def) notFound();
  const sp = await searchParams;
  const { supabase, user } = await requireUser();

  const q = cleanSearch(param(sp.q) ?? "");
  const hasOwner = def.fields.some((f) => f.name === "owner_id");
  const view = hasOwner && param(sp.view) === "mine" ? "mine" : "all";
  const page = Math.max(1, Number(param(sp.page) ?? 1) || 1);

  const sortParam = param(sp.sort) ?? def.defaultSort.field;
  const sortField =
    sortParam === "__name"
      ? def.sortNameField
      : getField(def, sortParam) && getField(def, sortParam)?.type !== "lookup"
        ? sortParam
        : def.defaultSort.field;
  const ascending = param(sp.dir) ? param(sp.dir) === "asc" : def.defaultSort.ascending;

  let query = supabase.from(def.table).select(selectFor(def), { count: "exact" });
  if (q) query = query.or(orIlike(def.searchFields, q));
  if (view === "mine") query = query.eq("owner_id", user.id);

  // filter by any lookup passed in the URL, e.g. /contacts?account_id=…
  const activeFilters: { label: string; field: string }[] = [];
  for (const f of def.fields) {
    const v = param(sp[f.name]);
    if (f.type === "lookup" && v && /^[0-9a-f-]{36}$/i.test(v)) {
      query = query.eq(f.name, v);
      activeFilters.push({ label: f.label, field: f.name });
    }
  }

  const from = (page - 1) * PAGE_SIZE;
  const { data, count, error } = await query
    .order(sortField, { ascending, nullsFirst: false })
    .range(from, from + PAGE_SIZE - 1);

  const rows = await resolveSelfRefs(supabase, def, (data ?? []) as unknown as Row[]);
  const total = count ?? 0;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const columns = def.listColumns;
  const urlWith = (patch: Record<string, string | undefined>) => {
    const u = new URLSearchParams();
    for (const [k, v] of Object.entries(sp)) if (typeof v === "string") u.set(k, v);
    for (const [k, v] of Object.entries(patch)) {
      if (v === undefined) u.delete(k);
      else u.set(k, v);
    }
    const s = u.toString();
    return `/${def.key}${s ? `?${s}` : ""}`;
  };

  return (
    <div className="card">
      <div className="flex flex-wrap items-center gap-3 border-b border-line px-4 py-3">
        <ObjectIcon def={def} size="lg" />
        <div className="mr-auto">
          <p className="text-xs text-muted">{def.plural}</p>
          <h1 className="text-lg font-bold">
            {view === "mine" ? `My ${def.plural}` : `All ${def.plural}`}
            {activeFilters.length > 0 && (
              <span className="ml-2 text-sm font-normal text-muted">
                filtered by {activeFilters.map((f) => f.label).join(", ")} ·{" "}
                <Link className="link" href={`/${def.key}`}>
                  clear
                </Link>
              </span>
            )}
          </h1>
          <p className="text-xs text-muted">
            {total} item{total === 1 ? "" : "s"} · sorted by {getField(def, sortField)?.label ?? "Name"}
          </p>
        </div>
        {hasOwner && (
          <div className="flex overflow-hidden rounded border border-gray-300 text-sm">
            <Link
              href={urlWith({ view: undefined, page: undefined })}
              className={`px-3 py-1.5 ${view === "all" ? "bg-brand text-white" : "bg-white text-brand"}`}
            >
              All
            </Link>
            <Link
              href={urlWith({ view: "mine", page: undefined })}
              className={`px-3 py-1.5 ${view === "mine" ? "bg-brand text-white" : "bg-white text-brand"}`}
            >
              Mine
            </Link>
          </div>
        )}
        <form className="w-56">
          {view === "mine" && <input type="hidden" name="view" value="mine" />}
          <input name="q" defaultValue={q} placeholder={`Search this list…`} className="input" type="search" />
        </form>
        {def.canCreate !== false && (
          <Link href={`/${def.key}/new`} className="btn-primary">
            New
          </Link>
        )}
      </div>

      <ErrorAlert message={error?.message} />

      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr>
              <th className="th w-10">#</th>
              {columns.map((c) => {
                const f = c === "__name" ? null : getField(def, c);
                const label = c === "__name" ? OBJECTS[def.key as ObjectKey].label + " Name" : f?.label ?? c;
                const sortable = c === "__name" || (f && f.type !== "lookup");
                const isSorted = (c === "__name" ? def.sortNameField : c) === sortField;
                return (
                  <th key={c} className="th">
                    {sortable ? (
                      <Link
                        href={urlWith({ sort: c, dir: isSorted && ascending ? "desc" : "asc", page: undefined })}
                        className="hover:text-ink"
                      >
                        {label} {isSorted ? (ascending ? "▲" : "▼") : ""}
                      </Link>
                    ) : (
                      label
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td className="td py-10 text-center text-muted" colSpan={columns.length + 1}>
                  No {def.plural.toLowerCase()} to display.
                  {def.canCreate !== false && (
                    <>
                      {" "}
                      <Link className="link" href={`/${def.key}/new`}>
                        Create one
                      </Link>
                      .
                    </>
                  )}
                </td>
              </tr>
            )}
            {rows.map((r, i) => (
              <tr key={String(r.id)} className="hover:bg-gray-50">
                <td className="td text-xs text-muted">{from + i + 1}</td>
                {columns.map((c) => {
                  if (c === "__name") {
                    return (
                      <td key={c} className="td">
                        <Link className="link font-medium" href={recordHref(def, String(r.id))}>
                          {recordName(def, r)}
                        </Link>
                      </td>
                    );
                  }
                  const f = getField(def, c);
                  return (
                    <td key={c} className="td">
                      {f ? <FieldValue field={f} record={r} /> : String(r[c] ?? "")}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {pages > 1 && (
        <div className="flex items-center justify-between px-4 py-3 text-sm">
          <span className="text-muted">
            Page {page} of {pages}
          </span>
          <div className="flex gap-2">
            {page > 1 && (
              <Link className="btn-neutral" href={urlWith({ page: String(page - 1) })}>
                Previous
              </Link>
            )}
            {page < pages && (
              <Link className="btn-neutral" href={urlWith({ page: String(page + 1) })}>
                Next
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
