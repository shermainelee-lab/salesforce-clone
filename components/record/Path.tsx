import Link from "next/link";
import { getField, optionLabel, type ObjectDef } from "@/lib/objects";
import { setFieldValueForm } from "@/lib/actions";

type Row = Record<string, unknown>;

const CHEVRON =
  "[clip-path:polygon(0_0,calc(100%-12px)_0,100%_50%,calc(100%-12px)_100%,0_100%,12px_50%)] first:[clip-path:polygon(0_0,calc(100%-12px)_0,100%_50%,calc(100%-12px)_100%,0_100%)]";

export function Path({ def, record }: { def: ObjectDef; record: Row }) {
  if (!def.path) return null;
  const field = getField(def, def.path.field);
  if (!field) return null;
  const id = String(record.id);
  const current = String(record[def.path.field] ?? "");
  const idx = def.path.steps.indexOf(current);
  const isLeadConverted = def.key === "leads" && current === "converted";

  return (
    <div className="card mb-4 p-3">
      <ol className="flex w-full gap-0.5">
        {def.path.steps.map((step, i) => {
          const isCurrent = step === current;
          const lostShowsWonAsTodo = step === "closed_won" && current === "closed_lost";
          const done = idx >= 0 && i < idx && !lostShowsWonAsTodo;
          const color = isCurrent
            ? step === "closed_lost"
              ? "bg-gray-600 text-white"
              : "bg-brand-dark text-white"
            : done
              ? "bg-green-600 text-white hover:bg-green-700"
              : "bg-gray-200 text-gray-700 hover:bg-gray-300";
          const label = optionLabel(field, step);
          const cls = `flex-1 min-w-0 ${CHEVRON}`;
          const inner = `w-full truncate px-4 py-2 text-center text-xs font-semibold ${color}`;

          // The final lead step is the conversion flow, not a plain status change
          if (def.key === "leads" && step === "converted") {
            return (
              <li key={step} className={cls}>
                {isLeadConverted ? (
                  <span className={`block ${inner}`}>{label}</span>
                ) : (
                  <Link href={`/leads/${id}/convert`} className={`block ${inner}`} title="Convert lead">
                    {label}
                  </Link>
                )}
              </li>
            );
          }

          return (
            <li key={step} className={cls}>
              <form action={setFieldValueForm.bind(null, def.key, id, def.path!.field, step)}>
                <button
                  type="submit"
                  className={`${inner} cursor-pointer disabled:cursor-default`}
                  disabled={isCurrent || isLeadConverted}
                  title={`Mark ${field.label} as ${label}`}
                >
                  {done ? "✓ " : ""}
                  {label}
                </button>
              </form>
            </li>
          );
        })}
      </ol>
      {idx < 0 && current && (
        <p className="mt-2 text-xs text-muted">
          {field.label}: <strong>{optionLabel(field, current)}</strong>
        </p>
      )}
    </div>
  );
}
