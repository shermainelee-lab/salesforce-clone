import Link from "next/link";
import { requireUser } from "@/lib/supabase/server";
import { getField, OBJECTS, recordHref, recordName, SEARCH_OBJECTS, selectFor } from "@/lib/objects";
import { cleanSearch, orIlike } from "@/lib/data";
import { FieldValue } from "@/components/FieldValue";
import { ObjectIcon } from "@/components/ObjectIcon";
import { param } from "@/components/Alert";

export const metadata = { title: "Search" };

type SP = Promise<Record<string, string | string[] | undefined>>;
type Row = Record<string, unknown>;

export default async function SearchPage({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const q = cleanSearch(param(sp.q) ?? "");
  const { supabase } = await requireUser();

  const results = q
    ? await Promise.all(
        SEARCH_OBJECTS.map(async (key) => {
          const def = OBJECTS[key];
          const { data } = await supabase
            .from(def.table)
            .select(selectFor(def))
            .or(orIlike(def.searchFields, q))
            .order(def.sortNameField)
            .limit(10);
          return { def, rows: (data ?? []) as unknown as Row[] };
        })
      )
    : [];
  const hits = results.filter((r) => r.rows.length > 0);
  const total = hits.reduce((s, r) => s + r.rows.length, 0);

  return (
    <div className="space-y-4">
      <div className="card px-4 py-3">
        <p className="text-xs text-muted">Search Results</p>
        <h1 className="text-lg font-bold">{q ? `“${q}”` : "Search"}</h1>
        {q && (
          <p className="text-xs text-muted">
            {total} result{total === 1 ? "" : "s"} in {hits.length} object{hits.length === 1 ? "" : "s"}
          </p>
        )}
      </div>

      {q && hits.length === 0 && (
        <div className="card px-4 py-10 text-center text-sm text-muted">No results. Try a different search term.</div>
      )}

      {hits.map(({ def, rows }) => {
        const cols = def.listColumns.filter((c) => c !== "__name").slice(0, 4);
        return (
          <section key={def.key} className="card">
            <div className="card-header">
              <div className="flex items-center gap-2">
                <ObjectIcon def={def} size="sm" />
                <h2 className="card-title">
                  {def.plural} ({rows.length})
                </h2>
              </div>
              <Link className="link text-sm" href={`/${def.key}?q=${encodeURIComponent(q)}`}>
                View all
              </Link>
            </div>
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  <th className="th">Name</th>
                  {cols.map((c) => (
                    <th key={c} className="th">
                      {getField(def, c)?.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={String(r.id)}>
                    <td className="td">
                      <Link className="link" href={recordHref(def, String(r.id))}>
                        {recordName(def, r)}
                      </Link>
                    </td>
                    {cols.map((c) => {
                      const f = getField(def, c);
                      return (
                        <td key={c} className="td">
                          {f ? <FieldValue field={f} record={r} /> : null}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        );
      })}
    </div>
  );
}
