import Link from "next/link";
import type { createClient } from "@/lib/supabase/server";
import type { ObjectDef } from "@/lib/objects";
import { titleCase } from "@/lib/objects";
import { formatDate, formatDateTime } from "@/lib/format";
import { addNote, deleteNote, logActivity, setActivityStatus } from "@/lib/actions";
import { SubmitButton } from "@/components/SubmitButton";

type Client = Awaited<ReturnType<typeof createClient>>;
type Row = Record<string, unknown>;

const TYPE_STYLE: Record<string, { bg: string; icon: string }> = {
  task: { bg: "#3ba755", icon: "✓" },
  call: { bg: "#48c3cc", icon: "☎" },
  email: { bg: "#939393", icon: "✉" },
  meeting: { bg: "#cb65ff", icon: "◷" },
};

export async function ActivityPanel({
  def,
  recordId,
  supabase,
  userId,
}: {
  def: ObjectDef;
  recordId: string;
  supabase: Client;
  userId: string;
}) {
  if (!def.activityKey) return null;
  const path = `/${def.key}/${recordId}`;

  const [{ data: acts }, { data: noteRows }] = await Promise.all([
    supabase
      .from("activities")
      .select("id, type, subject, status, priority, due_date, completed_at, owner_id, created_at")
      .eq(def.activityKey, recordId)
      .order("due_date", { ascending: true, nullsFirst: false })
      .limit(100),
    supabase
      .from("notes")
      .select("id, title, body, created_at, created_by, author:profiles!notes_created_by_fkey(full_name)")
      .eq(def.activityKey, recordId)
      .order("created_at", { ascending: false })
      .limit(50),
  ]);
  const activities = (acts ?? []) as unknown as Row[];
  const notes = (noteRows ?? []) as unknown as Row[];
  const open = activities.filter((a) => a.status !== "completed");
  const done = activities
    .filter((a) => a.status === "completed")
    .sort((a, b) => String(b.completed_at ?? "").localeCompare(String(a.completed_at ?? "")));

  const item = (a: Row) => {
    const style = TYPE_STYLE[String(a.type)] ?? TYPE_STYLE.task;
    const completed = a.status === "completed";
    const overdue = !completed && a.due_date && String(a.due_date) < new Date().toISOString().slice(0, 10);
    return (
      <li key={String(a.id)} className="flex items-start gap-3 py-2">
        <span
          className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded text-xs text-white"
          style={{ backgroundColor: style.bg }}
          aria-hidden
        >
          {style.icon}
        </span>
        <div className="min-w-0 flex-1">
          <Link href={`/activities/${String(a.id)}`} className={`link text-sm ${completed ? "line-through" : ""}`}>
            {String(a.subject)}
          </Link>
          <p className={`text-xs ${overdue ? "font-semibold text-red-700" : "text-muted"}`}>
            {titleCase(String(a.type))}
            {a.due_date ? ` · ${overdue ? "Overdue · " : ""}Due ${formatDate(a.due_date)}` : ""}
            {a.priority === "high" ? " · High priority" : ""}
          </p>
        </div>
        {a.owner_id === userId && (
          <form action={setActivityStatus.bind(null, String(a.id), completed ? "not_started" : "completed", path)}>
            <SubmitButton
              className="rounded border border-gray-300 px-1.5 text-xs text-muted hover:bg-gray-50"
              title={completed ? "Reopen" : "Mark complete"}
            >
              {completed ? "↺" : "✓"}
            </SubmitButton>
          </form>
        )}
      </li>
    );
  };

  return (
    <div className="space-y-4">
      <section className="card">
        <div className="card-header">
          <h2 className="card-title">Activity</h2>
        </div>
        <form action={logActivity.bind(null, def.key, recordId)} className="space-y-2 border-b border-line p-4">
          <div className="flex gap-2">
            <select name="type" className="input w-28" aria-label="Activity type" defaultValue="task">
              <option value="task">Task</option>
              <option value="call">Log a Call</option>
              <option value="email">Email</option>
              <option value="meeting">Meeting</option>
            </select>
            <input name="subject" required placeholder="Subject" className="input" />
          </div>
          <div className="flex gap-2">
            <input name="due_date" type="date" className="input" aria-label="Due date" />
            <select name="priority" className="input w-28" aria-label="Priority" defaultValue="normal">
              <option value="low">Low</option>
              <option value="normal">Normal</option>
              <option value="high">High</option>
            </select>
          </div>
          <textarea name="description" rows={2} placeholder="Comments" className="input" />
          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2 text-xs text-muted">
              <input type="checkbox" name="completed" className="h-4 w-4" /> Already done
            </label>
            <SubmitButton pendingText="Saving…">Save</SubmitButton>
          </div>
        </form>
        <div className="px-4 py-2">
          <h3 className="mt-1 text-xs font-semibold tracking-wide text-muted uppercase">Upcoming &amp; Overdue</h3>
          {open.length === 0 ? (
            <p className="py-2 text-sm text-muted">No next steps. Open activities show up here.</p>
          ) : (
            <ul className="divide-y divide-line">{open.map(item)}</ul>
          )}
          <h3 className="mt-3 text-xs font-semibold tracking-wide text-muted uppercase">Past Activity</h3>
          {done.length === 0 ? (
            <p className="py-2 text-sm text-muted">No past activity.</p>
          ) : (
            <ul className="divide-y divide-line">{done.map(item)}</ul>
          )}
        </div>
      </section>

      <section className="card">
        <div className="card-header">
          <h2 className="card-title">Notes ({notes.length})</h2>
        </div>
        <form action={addNote.bind(null, def.key, recordId)} className="space-y-2 border-b border-line p-4">
          <input name="title" placeholder="Title (optional)" className="input" />
          <textarea name="body" rows={3} required placeholder="Write a note…" className="input" />
          <div className="flex justify-end">
            <SubmitButton pendingText="Saving…">Add Note</SubmitButton>
          </div>
        </form>
        <ul className="divide-y divide-line">
          {notes.map((n) => {
            const author = (n.author as { full_name?: string } | null)?.full_name ?? "Unknown";
            return (
              <li key={String(n.id)} className="px-4 py-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    {n.title ? <p className="text-sm font-semibold">{String(n.title)}</p> : null}
                    <p className="text-xs text-muted">
                      {author} · {formatDateTime(n.created_at)}
                    </p>
                  </div>
                  {n.created_by === userId && (
                    <form action={deleteNote.bind(null, String(n.id), path)}>
                      <SubmitButton
                        className="text-xs text-muted hover:text-red-700"
                        confirmMessage="Delete this note?"
                      >
                        Delete
                      </SubmitButton>
                    </form>
                  )}
                </div>
                <p className="mt-1 text-sm whitespace-pre-wrap">{String(n.body)}</p>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
