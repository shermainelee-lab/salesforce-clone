import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireUser } from "@/lib/supabase/server";
import { OBJECTS, recordName } from "@/lib/objects";
import { convertLead } from "@/lib/actions";
import { ObjectIcon } from "@/components/ObjectIcon";
import { ErrorAlert, param } from "@/components/Alert";
import { SubmitButton } from "@/components/SubmitButton";

type Params = Promise<{ object: string; id: string }>;
type SP = Promise<Record<string, string | string[] | undefined>>;
type Row = Record<string, unknown>;

export const metadata = { title: "Convert Lead" };

export default async function ConvertLeadPage({ params, searchParams }: { params: Params; searchParams: SP }) {
  const { object, id } = await params;
  if (object !== "leads" || !/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const sp = await searchParams;
  const { supabase } = await requireUser();

  const { data } = await supabase.from("leads").select("*").eq("id", id).maybeSingle();
  if (!data) notFound();
  const lead = data as unknown as Row;
  if (lead.status === "converted") redirect(`/leads/${id}`);

  const company = String(lead.company ?? "");
  const { data: accountRows } = await supabase.from("accounts").select("id, name").order("name").limit(1000);
  const accounts = (accountRows ?? []) as unknown as Row[];
  const match = accounts.find((a) => String(a.name).toLowerCase() === company.toLowerCase());
  const leadName = recordName(OBJECTS.leads, lead);

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-4 flex items-center gap-3">
        <ObjectIcon def={OBJECTS.leads} size="lg" />
        <div>
          <p className="text-xs text-muted">Convert Lead</p>
          <h1 className="text-xl font-bold">{leadName}</h1>
        </div>
      </div>
      <ErrorAlert message={param(sp.error)} />

      <form action={convertLead.bind(null, id)} className="card divide-y divide-line">
        <fieldset className="p-5">
          <legend className="mb-3 flex items-center gap-2 text-sm font-semibold">
            <ObjectIcon def={OBJECTS.accounts} size="sm" /> Account
          </legend>
          <label className="mb-2 flex items-center gap-2 text-sm">
            <input type="radio" name="account_mode" value="new" defaultChecked={!match} />
            Create new account: <strong>{company}</strong>
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="radio" name="account_mode" value="existing" defaultChecked={Boolean(match)} />
            Choose existing account
          </label>
          <select
            name="existing_account_id"
            className="input mt-2 ml-6 w-auto"
            defaultValue={match ? String(match.id) : ""}
            aria-label="Existing account"
          >
            <option value="">--Select account--</option>
            {accounts.map((a) => (
              <option key={String(a.id)} value={String(a.id)}>
                {String(a.name)}
              </option>
            ))}
          </select>
          {match && <p className="mt-2 ml-6 text-xs text-muted">An account named “{company}” already exists.</p>}
        </fieldset>

        <fieldset className="p-5">
          <legend className="mb-3 flex items-center gap-2 text-sm font-semibold">
            <ObjectIcon def={OBJECTS.contacts} size="sm" /> Contact
          </legend>
          <p className="text-sm">
            A new contact <strong>{leadName}</strong> will be created on the account, and the lead&apos;s activities,
            notes and campaign history move to it.
          </p>
        </fieldset>

        <fieldset className="p-5">
          <legend className="mb-3 flex items-center gap-2 text-sm font-semibold">
            <ObjectIcon def={OBJECTS.opportunities} size="sm" /> Opportunity
          </legend>
          <label className="label" htmlFor="opportunity_name">
            Opportunity Name
          </label>
          <input
            id="opportunity_name"
            name="opportunity_name"
            className="input"
            defaultValue={`${company} - New Business`}
          />
          <label className="mt-3 flex items-center gap-2 text-sm">
            <input type="checkbox" name="skip_opportunity" className="h-4 w-4" />
            Don&apos;t create an opportunity upon conversion
          </label>
        </fieldset>

        <div className="flex justify-end gap-2 bg-gray-50 px-5 py-3">
          <Link href={`/leads/${id}`} className="btn-neutral">
            Cancel
          </Link>
          <SubmitButton pendingText="Converting…">Convert</SubmitButton>
        </div>
      </form>
    </div>
  );
}
