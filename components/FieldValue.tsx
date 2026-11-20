import Link from "next/link";
import { OBJECTS, recordName, refAlias, type FieldDef, type ObjectKey } from "@/lib/objects";
import { formatFieldText } from "@/lib/format";

type Row = Record<string, unknown>;

const BADGE: Record<string, string> = {
  hot: "bg-red-100 text-red-800",
  warm: "bg-amber-100 text-amber-800",
  cold: "bg-sky-100 text-sky-800",
  closed_won: "bg-green-100 text-green-800",
  closed_lost: "bg-gray-200 text-gray-700",
  converted: "bg-green-100 text-green-800",
  closed: "bg-gray-200 text-gray-700",
  completed: "bg-green-100 text-green-800",
  critical: "bg-red-100 text-red-800",
  high: "bg-orange-100 text-orange-800",
  escalated: "bg-red-100 text-red-800",
};

export function FieldValue({ field, record }: { field: FieldDef; record: Row }) {
  const value = record[field.name];

  if (field.type === "lookup" && field.lookup) {
    const ref = record[refAlias(field.name)] as Row | null | undefined;
    if (!ref || !value) return <span className="text-muted"></span>;
    const target = OBJECTS[field.lookup as ObjectKey];
    return (
      <Link className="link" href={`/${target.key}/${String(ref.id)}`}>
        {recordName(target, ref)}
      </Link>
    );
  }

  if (value === null || value === undefined || value === "") return <span className="text-muted"></span>;

  switch (field.type) {
    case "email":
      return (
        <a className="link" href={`mailto:${String(value)}`}>
          {String(value)}
        </a>
      );
    case "phone":
      return (
        <a className="link" href={`tel:${String(value)}`}>
          {String(value)}
        </a>
      );
    case "url": {
      const href = /^https?:\/\//i.test(String(value)) ? String(value) : `https://${String(value)}`;
      return (
        <a className="link" href={href} target="_blank" rel="noreferrer">
          {String(value).replace(/^https?:\/\//i, "")}
        </a>
      );
    }
    case "boolean":
      return <input type="checkbox" checked={Boolean(value)} readOnly disabled className="h-4 w-4" />;
    case "picklist": {
      const cls = BADGE[String(value)];
      const text = formatFieldText(field, value);
      return cls ? <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${cls}`}>{text}</span> : <>{text}</>;
    }
    case "textarea":
      return <span className="whitespace-pre-wrap">{String(value)}</span>;
    default:
      return <>{formatFieldText(field, value)}</>;
  }
}
