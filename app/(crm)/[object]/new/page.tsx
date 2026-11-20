import { notFound } from "next/navigation";
import { requireUser } from "@/lib/supabase/server";
import { getObject } from "@/lib/objects";
import { loadLookupOptions } from "@/lib/data";
import { createRecord } from "@/lib/actions";
import { RecordForm } from "@/components/RecordForm";
import { ObjectIcon } from "@/components/ObjectIcon";
import { ErrorAlert, param } from "@/components/Alert";

type Params = Promise<{ object: string }>;
type SP = Promise<Record<string, string | string[] | undefined>>;

export async function generateMetadata({ params }: { params: Params }) {
  const def = getObject((await params).object);
  return { title: def ? `New ${def.label}` : "Not found" };
}

export default async function NewRecordPage({ params, searchParams }: { params: Params; searchParams: SP }) {
  const def = getObject((await params).object);
  if (!def || def.canCreate === false) notFound();
  const sp = await searchParams;
  const { supabase, user } = await requireUser();

  const lookupOptions = await loadLookupOptions(supabase, def);

  // Prefill from the URL (e.g. "New Contact" from an account page passes ?account_id=…)
  const prefill: Record<string, string> = {};
  if (def.fields.some((f) => f.name === "owner_id")) prefill.owner_id = user.id;
  for (const f of def.fields) {
    const v = param(sp[f.name]);
    if (v && !f.readOnly) prefill[f.name] = v;
  }

  const returnTo = param(sp.returnTo);
  const safeReturn = returnTo && returnTo.startsWith("/") && !returnTo.startsWith("//") ? returnTo : undefined;
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) if (typeof v === "string" && k !== "error") qs.set(k, v);
  const formPath = `/${def.key}/new${qs.toString() ? `?${qs}` : ""}`;

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-4 flex items-center gap-3">
        <ObjectIcon def={def} size="lg" />
        <h1 className="text-xl font-bold">New {def.label}</h1>
      </div>
      <ErrorAlert message={param(sp.error)} />
      <RecordForm
        def={def}
        record={null}
        action={createRecord.bind(null, def.key, formPath)}
        lookupOptions={lookupOptions}
        prefill={prefill}
        cancelHref={safeReturn ?? `/${def.key}`}
        next={safeReturn}
      />
    </div>
  );
}
