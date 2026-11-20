import Link from "next/link";
import { resolveDefault, type FieldDef, type ObjectDef, type Option } from "@/lib/objects";
import { utcToLocalInput } from "@/lib/format";
import { SubmitButton } from "./SubmitButton";

type Row = Record<string, unknown>;

function groupBySection(fields: FieldDef[]) {
  const sections: { name: string; fields: FieldDef[] }[] = [];
  for (const f of fields) {
    const name = f.section ?? "Information";
    let s = sections.find((x) => x.name === name);
    if (!s) {
      s = { name, fields: [] };
      sections.push(s);
    }
    s.fields.push(f);
  }
  return sections;
}

function initialValue(field: FieldDef, record: Row | null, prefill: Record<string, string>): string {
  if (record) {
    const v = record[field.name];
    if (v === null || v === undefined) return "";
    if (field.type === "datetime") return utcToLocalInput(v);
    return String(v);
  }
  return prefill[field.name] ?? resolveDefault(field) ?? "";
}

function Input({
  field,
  value,
  options,
}: {
  field: FieldDef;
  value: string;
  options?: Option[];
}) {
  const common = { id: field.name, name: field.name, required: field.required };

  switch (field.type) {
    case "textarea":
      return <textarea {...common} defaultValue={value} rows={4} className="input" />;
    case "picklist":
    case "lookup": {
      const list = [...(options ?? field.options ?? [])];
      if (value && !list.some((o) => o.value === value)) list.unshift({ value, label: value });
      return (
        <select {...common} defaultValue={value} className="input">
          {(!field.required || !value) && <option value="">--None--</option>}
          {list.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      );
    }
    case "boolean":
      return (
        <>
          <input type="hidden" name={`__present_${field.name}`} value="1" />
          <input id={field.name} name={field.name} type="checkbox" defaultChecked={value === "true"} className="h-4 w-4" />
        </>
      );
    case "number":
    case "currency":
    case "percent":
      return (
        <input
          {...common}
          type="number"
          step={field.type === "number" ? "1" : "0.01"}
          min={field.type === "percent" ? 0 : undefined}
          max={field.type === "percent" ? 100 : undefined}
          defaultValue={value}
          className="input"
        />
      );
    case "date":
      return <input {...common} type="date" defaultValue={value} className="input" />;
    case "datetime":
      return <input {...common} type="datetime-local" defaultValue={value} className="input" />;
    case "email":
      return <input {...common} type="email" defaultValue={value} className="input" />;
    case "phone":
      return <input {...common} type="tel" defaultValue={value} className="input" />;
    case "url":
      return <input {...common} type="text" inputMode="url" defaultValue={value} className="input" />;
    default:
      return <input {...common} type="text" defaultValue={value} className="input" />;
  }
}

export function RecordForm({
  def,
  record,
  action,
  lookupOptions,
  prefill = {},
  cancelHref,
  next,
}: {
  def: ObjectDef;
  record: Row | null;
  action: (formData: FormData) => void | Promise<void>;
  lookupOptions: Record<string, Option[]>;
  prefill?: Record<string, string>;
  cancelHref: string;
  next?: string;
}) {
  const editable = def.fields.filter((f) => !f.readOnly);
  const sections = groupBySection(editable);

  return (
    <form action={action} className="card">
      {next && <input type="hidden" name="__next" value={next} />}
      {sections.map((section) => (
        <fieldset key={section.name} className="px-6 py-4">
          <legend className="mb-3 w-full rounded bg-gray-100 px-3 py-1.5 text-sm font-semibold">{section.name}</legend>
          <div className="grid grid-cols-1 gap-x-8 gap-y-4 md:grid-cols-2">
            {section.fields.map((f) => (
              <div key={f.name} className={f.type === "textarea" ? "md:col-span-2" : ""}>
                <label htmlFor={f.name} className="label">
                  {f.required && <span className="mr-0.5 text-red-600">*</span>}
                  {f.label}
                </label>
                <Input field={f} value={initialValue(f, record, prefill)} options={lookupOptions[f.name]} />
                {f.help && <p className="mt-1 text-xs text-muted">{f.help}</p>}
              </div>
            ))}
          </div>
        </fieldset>
      ))}
      <div className="sticky bottom-0 flex justify-center gap-2 border-t border-line bg-gray-50 px-6 py-3">
        <Link href={cancelHref} className="btn-neutral">
          Cancel
        </Link>
        <SubmitButton pendingText="Saving…">Save</SubmitButton>
      </div>
    </form>
  );
}
