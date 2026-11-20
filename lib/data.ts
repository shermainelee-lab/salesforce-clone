import type { createClient } from "./supabase/server";
import { isSelfLookup, OBJECTS, recordName, refAlias, type ObjectDef, type ObjectKey, type Option } from "./objects";

type Client = Awaited<ReturnType<typeof createClient>>;

/** Options for every editable lookup field on a form (one query per target object). */
export async function loadLookupOptions(supabase: Client, def: ObjectDef): Promise<Record<string, Option[]>> {
  const lookups = def.fields.filter((f) => f.type === "lookup" && f.lookup && !f.readOnly);
  const targets = Array.from(new Set(lookups.map((f) => f.lookup as ObjectKey)));

  const byTarget = new Map<ObjectKey, Option[]>();
  await Promise.all(
    targets.map(async (key) => {
      const target = OBJECTS[key];
      let q = supabase
        .from(target.table)
        .select(["id", ...target.titleFields].join(","))
        .order(target.sortNameField, { ascending: true })
        .limit(1000);
      if (key === "users") q = q.eq("is_active", true);
      const { data } = await q;
      const rows = (data ?? []) as unknown as Record<string, unknown>[];
      byTarget.set(
        key,
        rows.map((r) => ({ value: String(r.id), label: recordName(target, r) }))
      );
    })
  );

  const out: Record<string, Option[]> = {};
  for (const f of lookups) out[f.name] = byTarget.get(f.lookup as ObjectKey) ?? [];
  return out;
}

/** Strip characters that would break a PostgREST or() filter. */
export function cleanSearch(q: string) {
  return q.replace(/[,()*%\\:"']/g, " ").trim().slice(0, 100);
}

export function orIlike(fields: string[], q: string) {
  return fields.map((f) => `${f}.ilike.%${q}%`).join(",");
}

/** Attach ref_<field> for self-referencing lookups (e.g. accounts.parent_account_id) with one extra query. */
export async function resolveSelfRefs(supabase: Client, def: ObjectDef, rows: Record<string, unknown>[]) {
  const fields = def.fields.filter((f) => isSelfLookup(def, f));
  if (fields.length === 0 || rows.length === 0) return rows;
  const ids = Array.from(
    new Set(fields.flatMap((f) => rows.map((r) => r[f.name]).filter((v): v is string => typeof v === "string")))
  );
  if (ids.length === 0) return rows;
  const { data } = await supabase.from(def.table).select(["id", ...def.titleFields].join(",")).in("id", ids);
  const byId = new Map(((data ?? []) as unknown as Record<string, unknown>[]).map((r) => [String(r.id), r]));
  for (const r of rows) for (const f of fields) r[refAlias(f.name)] = byId.get(String(r[f.name])) ?? null;
  return rows;
}
