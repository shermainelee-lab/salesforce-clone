import type { ObjectDef } from "@/lib/objects";

export function ObjectIcon({ def, size = "md" }: { def: Pick<ObjectDef, "color" | "icon">; size?: "sm" | "md" | "lg" }) {
  const dims = size === "sm" ? "h-6 w-6 text-[10px]" : size === "lg" ? "h-10 w-10 text-sm" : "h-8 w-8 text-xs";
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center rounded font-bold text-white ${dims}`}
      style={{ backgroundColor: def.color }}
      aria-hidden
    >
      {def.icon}
    </span>
  );
}
