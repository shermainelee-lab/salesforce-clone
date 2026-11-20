import Link from "next/link";
import type { createClient } from "@/lib/supabase/server";
import { OBJECTS } from "@/lib/objects";
import { formatCurrency, formatNumber } from "@/lib/format";
import { addLineItem, deleteLineItem } from "@/lib/actions";
import { ObjectIcon } from "@/components/ObjectIcon";
import { SubmitButton } from "@/components/SubmitButton";

type Client = Awaited<ReturnType<typeof createClient>>;
type Row = Record<string, unknown>;

export async function LineItems({ opportunityId, supabase }: { opportunityId: string; supabase: Client }) {
  const [{ data: items }, { data: products }] = await Promise.all([
    supabase
      .from("opportunity_line_items")
      .select("*, product:products!opportunity_line_items_product_id_fkey(id, name, product_code)")
      .eq("opportunity_id", opportunityId)
      .order("created_at"),
    supabase.from("products").select("id, name, product_code, unit_price").eq("is_active", true).order("name"),
  ]);
  const rows = (items ?? []) as unknown as Row[];
  const catalog = (products ?? []) as unknown as Row[];
  const total = rows.reduce((s, r) => s + Number(r.total_price ?? 0), 0);

  return (
    <section className="card">
      <div className="card-header">
        <div className="flex items-center gap-2">
          <ObjectIcon def={OBJECTS.products} size="sm" />
          <h2 className="card-title">Products ({rows.length})</h2>
        </div>
        {rows.length > 0 && <span className="text-sm font-semibold">{formatCurrency(total)}</span>}
      </div>
      {rows.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <th className="th">Product</th>
                <th className="th text-right">Qty</th>
                <th className="th text-right">Sales Price</th>
                <th className="th text-right">Discount</th>
                <th className="th text-right">Total</th>
                <th className="th w-10" />
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const p = r.product as Row | null;
                return (
                  <tr key={String(r.id)}>
                    <td className="td">
                      {p ? (
                        <Link className="link" href={`/products/${String(p.id)}`}>
                          {String(p.name)}
                        </Link>
                      ) : (
                        "—"
                      )}
                      {p?.product_code ? <span className="ml-1 text-xs text-muted">{String(p.product_code)}</span> : null}
                    </td>
                    <td className="td text-right">{formatNumber(r.quantity)}</td>
                    <td className="td text-right">{formatCurrency(r.unit_price)}</td>
                    <td className="td text-right">{Number(r.discount) ? `${r.discount}%` : ""}</td>
                    <td className="td text-right font-medium">{formatCurrency(r.total_price)}</td>
                    <td className="td">
                      <form action={deleteLineItem.bind(null, String(r.id), opportunityId)}>
                        <SubmitButton
                          className="text-xs text-muted hover:text-red-700"
                          confirmMessage="Remove this product?"
                          title="Remove"
                        >
                          ✕
                        </SubmitButton>
                      </form>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <form action={addLineItem.bind(null, opportunityId)} className="grid grid-cols-2 gap-2 p-4 md:grid-cols-[2fr_1fr_1fr_1fr_auto]">
        <select name="product_id" required className="input col-span-2 md:col-span-1" aria-label="Product" defaultValue="">
          <option value="" disabled>
            Add a product…
          </option>
          {catalog.map((p) => (
            <option key={String(p.id)} value={String(p.id)}>
              {String(p.name)} — {formatCurrency(p.unit_price)}
            </option>
          ))}
        </select>
        <input name="quantity" type="number" min="0.01" step="0.01" defaultValue="1" className="input" aria-label="Quantity" />
        <input name="unit_price" type="number" min="0" step="0.01" placeholder="List price" className="input" aria-label="Sales price" />
        <input name="discount" type="number" min="0" max="100" step="0.01" placeholder="Disc. %" className="input" aria-label="Discount %" />
        <SubmitButton pendingText="Adding…">Add</SubmitButton>
      </form>
      <p className="px-4 pb-3 text-xs text-muted">The opportunity amount is recalculated automatically from its products.</p>
    </section>
  );
}
