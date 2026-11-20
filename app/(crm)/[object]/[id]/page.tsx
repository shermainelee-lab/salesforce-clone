import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/supabase/server";
import { getField, getObject, recordName, selectFor, type FieldDef } from "@/lib/objects";
import { formatFieldText } from "@/lib/format";
import { resolveSelfRefs } from "@/lib/data";
import { deleteRecord } from "@/lib/actions";
import { FieldValue } from "@/components/FieldValue";
import { ObjectIcon } from "@/components/ObjectIcon";
import { ErrorAlert, param } from "@/components/Alert";
import { SubmitButton } from "@/components/SubmitButton";
import { Path } from "@/components/record/Path";
import { RelatedListCard } from "@/components/record/RelatedList";
import { ActivityPanel } from "@/components/record/ActivityPanel";
import { LineItems } from "@/components/record/LineItems";
import { CampaignMembers } from "@/components/record/CampaignMembers";

type Params = Promise<{ object: string; id: string }>;
type SP = Promise<Record<string, string | string[] | undefined>>;
type Row = Record<string, unknown>;

const isUuid = (s: string) => /^[0-9a-f-]{36}$/i.test(s);

export async function generateMetadata({ params }: { params: Params }) {
  const { object } = await params;
  const def = getObject(object);
  return { title: def?.label ?? "Not found" };
}

function sections(fields: FieldDef[]) {
  const out: { name: string; fields: FieldDef[] }[] = [];
  for (const f of fields) {
    const name = f.section ?? "Information";
    let s = out.find((x) => x.name === name);
    if (!s) {
      s = { name, fields: [] };
      out.push(s);
    }
    s.fields.push(f);
  }
  // System info always last
  return [...out.filter((s) => s.name !== "System"), ...out.filter((s) => s.name === "System")];
}

export default async function RecordPage({ params, searchParams }: { params: Params; searchParams: SP }) {
  const { object, id } = await params;
  const def = getObject(object);
  if (!def || !isUuid(id)) notFound();
  const sp = await searchParams;
  const { supabase, user } = await requireUser();

  const { data } = await supabase.from(def.table).select(selectFor(def)).eq("id", id).maybeSingle();
  if (!data) notFound();
  const record = data as unknown as Row;
  await resolveSelfRefs(supabase, def, [record]);
  const name = recordName(def, record);
  const subtitleField = def.subtitleField ? getField(def, def.subtitleField) : undefined;
  const subtitle = subtitleField ? formatFieldText(subtitleField, record[subtitleField.name]) : "";
  const isConvertedLead = def.key === "leads" && record.status === "converted";
  const hasSidePanel = Boolean(def.activityKey);

  return (
    <div>
      <ErrorAlert message={param(sp.error)} />

      {/* Highlights panel */}
      <div className="card mb-4">
        <div className="flex flex-wrap items-start gap-3 px-4 py-3">
          <ObjectIcon def={def} size="lg" />
          <div className="mr-auto min-w-0">
            <p className="text-xs text-muted">
              <Link href={`/${def.key}`} className="hover:underline">
                {def.label}
              </Link>
              {subtitle && def.key === "cases" ? ` · #${subtitle}` : ""}
            </p>
            <h1 className="truncate text-xl font-bold">{name}</h1>
            {subtitle && def.key !== "cases" && <p className="text-sm text-muted">{subtitle}</p>}
          </div>
          <div className="flex flex-wrap gap-2">
            {def.key === "leads" && !isConvertedLead && (
              <Link href={`/leads/${id}/convert`} className="btn-primary">
                Convert
              </Link>
            )}
            {def.key === "accounts" && (
              <>
                <Link href={`/contacts/new?account_id=${id}&returnTo=/accounts/${id}`} className="btn-neutral">
                  New Contact
                </Link>
                <Link href={`/opportunities/new?account_id=${id}`} className="btn-neutral">
                  New Opportunity
                </Link>
              </>
            )}
            <Link href={`/${def.key}/${id}/edit`} className="btn-neutral">
              Edit
            </Link>
            {def.canDelete !== false && (
              <form action={deleteRecord.bind(null, def.key, id)}>
                <SubmitButton className="btn-danger" confirmMessage={`Delete this ${def.label.toLowerCase()}?`}>
                  Delete
                </SubmitButton>
              </form>
            )}
          </div>
        </div>
        <dl className="grid grid-cols-2 gap-4 border-t border-line px-4 py-3 md:grid-cols-5">
          {def.highlights.map((h) => {
            const f = getField(def, h);
            if (!f) return null;
            return (
              <div key={h} className="min-w-0">
                <dt className="text-xs text-muted">{f.label}</dt>
                <dd className="truncate text-sm">
                  <FieldValue field={f} record={record} />
                </dd>
              </div>
            );
          })}
        </dl>
      </div>

      {isConvertedLead && (
        <div className="mb-4 rounded border border-green-200 bg-green-50 px-4 py-2 text-sm text-green-900">
          This lead was converted. It&apos;s kept for reference — work continues on the converted account, contact and
          opportunity below.
        </div>
      )}

      <Path def={def} record={record} />

      <div className={hasSidePanel ? "grid grid-cols-1 gap-4 lg:grid-cols-3" : ""}>
        <div className="space-y-4 lg:col-span-2">
          {def.key === "opportunities" && <LineItems opportunityId={id} supabase={supabase} />}
          {def.key === "campaigns" && <CampaignMembers campaignId={id} supabase={supabase} />}

          <section className="card">
            <div className="card-header">
              <h2 className="card-title">Details</h2>
            </div>
            {sections(def.fields).map((s) => (
              <div key={s.name} className="px-4 py-3">
                <h3 className="mb-2 rounded bg-gray-100 px-3 py-1.5 text-sm font-semibold">{s.name}</h3>
                <dl className="grid grid-cols-1 gap-x-8 md:grid-cols-2">
                  {s.fields.map((f) => (
                    <div
                      key={f.name}
                      className={`border-b border-line py-2 ${f.type === "textarea" ? "md:col-span-2" : ""}`}
                    >
                      <dt className="text-xs text-muted">{f.label}</dt>
                      <dd className="min-h-5 text-sm">
                        <FieldValue field={f} record={record} />
                      </dd>
                    </div>
                  ))}
                </dl>
              </div>
            ))}
          </section>

          {(def.related ?? []).map((rel) => (
            <RelatedListCard key={`${rel.object}-${rel.field}`} rel={rel} parent={def} parentId={id} supabase={supabase} />
          ))}
        </div>

        {hasSidePanel && (
          <aside>
            <ActivityPanel def={def} recordId={id} supabase={supabase} userId={user.id} />
          </aside>
        )}
      </div>
    </div>
  );
}
