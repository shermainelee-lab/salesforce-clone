import Link from "next/link";
import type { createClient } from "@/lib/supabase/server";
import { OBJECTS, recordName } from "@/lib/objects";
import { addCampaignMember, removeCampaignMember, setCampaignMemberStatus } from "@/lib/actions";
import { ObjectIcon } from "@/components/ObjectIcon";
import { SubmitButton } from "@/components/SubmitButton";

type Client = Awaited<ReturnType<typeof createClient>>;
type Row = Record<string, unknown>;

export async function CampaignMembers({ campaignId, supabase }: { campaignId: string; supabase: Client }) {
  const [{ data: members }, { data: leads }, { data: contacts }] = await Promise.all([
    supabase
      .from("campaign_members")
      .select(
        "id, status, lead_id, contact_id, lead:leads!campaign_members_lead_id_fkey(id, first_name, last_name, company), contact:contacts!campaign_members_contact_id_fkey(id, first_name, last_name, title)"
      )
      .eq("campaign_id", campaignId)
      .order("created_at"),
    supabase.from("leads").select("id, first_name, last_name, company").neq("status", "converted").order("last_name").limit(500),
    supabase.from("contacts").select("id, first_name, last_name").order("last_name").limit(500),
  ]);
  const rows = (members ?? []) as unknown as Row[];
  const responded = rows.filter((r) => r.status === "responded").length;
  const leadRows = (leads ?? []) as unknown as Row[];
  const contactRows = (contacts ?? []) as unknown as Row[];

  return (
    <section className="card">
      <div className="card-header">
        <div className="flex items-center gap-2">
          <ObjectIcon def={OBJECTS.campaigns} size="sm" />
          <h2 className="card-title">Campaign Members ({rows.length})</h2>
        </div>
        {rows.length > 0 && (
          <span className="text-xs text-muted">
            {responded} responded · {Math.round((responded / rows.length) * 100)}% response rate
          </span>
        )}
      </div>
      {rows.length > 0 && (
        <table className="w-full border-collapse">
          <thead>
            <tr>
              <th className="th">Type</th>
              <th className="th">Name</th>
              <th className="th">Status</th>
              <th className="th w-10" />
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const lead = r.lead as Row | null;
              const contact = r.contact as Row | null;
              const isLead = Boolean(r.lead_id);
              const target = isLead ? OBJECTS.leads : OBJECTS.contacts;
              const ref = isLead ? lead : contact;
              const next = r.status === "responded" ? "sent" : "responded";
              return (
                <tr key={String(r.id)}>
                  <td className="td text-xs text-muted">{isLead ? "Lead" : "Contact"}</td>
                  <td className="td">
                    {ref ? (
                      <Link className="link" href={`/${target.key}/${String(ref.id)}`}>
                        {recordName(target, ref)}
                      </Link>
                    ) : (
                      "—"
                    )}
                    {isLead && lead?.company ? <span className="ml-1 text-xs text-muted">{String(lead.company)}</span> : null}
                  </td>
                  <td className="td">
                    <form action={setCampaignMemberStatus.bind(null, String(r.id), campaignId, next)}>
                      <SubmitButton
                        className={`rounded px-1.5 py-0.5 text-xs font-medium ${
                          r.status === "responded" ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-700"
                        }`}
                        title={`Mark as ${next}`}
                      >
                        {r.status === "responded" ? "Responded" : "Sent"}
                      </SubmitButton>
                    </form>
                  </td>
                  <td className="td">
                    <form action={removeCampaignMember.bind(null, String(r.id), campaignId)}>
                      <SubmitButton className="text-xs text-muted hover:text-red-700" confirmMessage="Remove member?" title="Remove">
                        ✕
                      </SubmitButton>
                    </form>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
      <form action={addCampaignMember.bind(null, campaignId)} className="flex gap-2 p-4">
        <select name="member" required className="input" defaultValue="" aria-label="Lead or contact">
          <option value="" disabled>
            Add a lead or contact…
          </option>
          <optgroup label="Leads">
            {leadRows.map((l) => (
              <option key={String(l.id)} value={`lead:${String(l.id)}`}>
                {recordName(OBJECTS.leads, l)} ({String(l.company)})
              </option>
            ))}
          </optgroup>
          <optgroup label="Contacts">
            {contactRows.map((c) => (
              <option key={String(c.id)} value={`contact:${String(c.id)}`}>
                {recordName(OBJECTS.contacts, c)}
              </option>
            ))}
          </optgroup>
        </select>
        <select name="status" className="input w-36" defaultValue="sent" aria-label="Member status">
          <option value="sent">Sent</option>
          <option value="responded">Responded</option>
        </select>
        <SubmitButton pendingText="Adding…">Add</SubmitButton>
      </form>
    </section>
  );
}
