import { notFound } from "next/navigation";
import { requireUser } from "@/lib/supabase/server";
import { getObject, recordName } from "@/lib/objects";
import { loadLookupOptions } from "@/lib/data";
import { updateRecord } from "@/lib/actions";
import { RecordForm } from "@/components/RecordForm";
import { ObjectIcon } from "@/components/ObjectIcon";
import { ErrorAlert, param } from "@/components/Alert";

type Params = Promise<{ object: string; id: string }>;
type SP = Promise<Record<string, string | string[] | undefined>>;

export const metadata = { title: "Edit" };

export default async function EditRecordPage({ params, searchParams }: { params: Params; searchParams: SP }) {
  const { object, id } = await params;
  const def = getObject(object);
  if (!def || !/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const sp = await searchParams;
  const { supabase } = await requireUser();

  const [{ data: record }, lookupOptions] = await Promise.all([
    supabase.from(def.table).select("*").eq("id", id).maybeSingle(),
    loadLookupOptions(supabase, def),
  ]);
  if (!record) notFound();
  const row = record as unknown as Record<string, unknown>;

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-4 flex items-center gap-3">
        <ObjectIcon def={def} size="lg" />
        <div>
          <p className="text-xs text-muted">Edit {def.label}</p>
          <h1 className="text-xl font-bold">{recordName(def, row)}</h1>
        </div>
      </div>
      <ErrorAlert message={param(sp.error)} />
      <RecordForm
        def={def}
        record={row}
        action={updateRecord.bind(null, def.key, id)}
        lookupOptions={lookupOptions}
        cancelHref={`/${def.key}/${id}`}
      />
    </div>
  );
}
