import Link from "next/link";
import type { createClient } from "@/lib/supabase/server";
import { getField, OBJECTS, recordHref, recordName, selectFor, type ObjectDef, type RelatedList } from "@/lib/objects";
import { FieldValue } from "@/components/FieldValue";
import { ObjectIcon } from "@/components/ObjectIcon";

type Client = Awaited<ReturnType<typeof createClient>>;
type Row = Record<string, unknown>;
const LIMIT = 6;

export async function RelatedListCard({
  rel,
  parent,
  parentId,
  supabase,
}: {
  rel: RelatedList;
  parent: ObjectDef;
  parentId: string;
  supabase: Client;
}) {
  const target = OBJECTS[rel.object];
  const cols = target.listColumns.filter((c) => c !== rel.field && c !== "__name").slice(0, 4);

  const { data, count } = await supabase
    .from(target.table)
    .select(selectFor(target), { count: "exact" })
    .eq(rel.field, parentId)
    .order(target.defaultSort.field, { ascending: target.defaultSort.ascending, nullsFirst: false })
    .limit(LIMIT);
  const rows = (data ?? []) as unknown as Row[];
  const total = count ?? rows.length;
  const returnTo = `/${parent.key}/${parentId}`;

  return (
    <section className="card">
      <div className="card-header">
        <div className="flex items-center gap-2">
          <ObjectIcon def={target} size="sm" />
          <h2 className="card-title">
            {rel.label ?? target.plural} ({total})
          </h2>
        </div>
        {target.canCreate !== false && (
          <Link
            className="btn-neutral"
            href={`/${target.key}/new?${rel.field}=${parentId}&returnTo=${encodeURIComponent(returnTo)}`}
          >
            New
          </Link>
        )}
      </div>
      {rows.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <th className="th">{target.label} Name</th>
                {cols.map((c) => (
                  <th key={c} className="th">
                    {getField(target, c)?.label ?? c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={String(r.id)}>
                  <td className="td">
                    <Link className="link" href={recordHref(target, String(r.id))}>
                      {recordName(target, r)}
                    </Link>
                  </td>
                  {cols.map((c) => {
                    const f = getField(target, c);
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
        </div>
      )}
      {total > LIMIT && (
        <div className="border-t border-line py-2 text-center text-sm">
          <Link className="link" href={`/${target.key}?${rel.field}=${parentId}`}>
            View All
          </Link>
        </div>
      )}
    </section>
  );
}
