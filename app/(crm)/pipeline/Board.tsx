"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { setFieldValue } from "@/lib/actions";

export type Card = {
  id: string;
  name: string;
  account: string | null;
  amount: number | null;
  closeDate: string;
  stage: string;
};

const fmt = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);

const fmtDate = (s: string) =>
  new Date(s + "T00:00:00Z").toLocaleDateString("en-US", { timeZone: "UTC", month: "short", day: "numeric" });

export function Board({ stages, initial }: { stages: { value: string; label: string }[]; initial: Card[] }) {
  const [cards, setCards] = useState(initial);
  const [dragId, setDragId] = useState<string | null>(null);
  const [over, setOver] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function move(id: string, stage: string) {
    const before = cards;
    const card = cards.find((c) => c.id === id);
    if (!card || card.stage === stage) return;
    setError(null);
    setCards(cards.map((c) => (c.id === id ? { ...c, stage } : c)));
    startTransition(async () => {
      const res = await setFieldValue("opportunities", id, "stage", stage);
      if (res.error) {
        setCards(before);
        setError(`${card.name}: ${res.error}`);
      }
    });
  }

  return (
    <div>
      {error && (
        <div role="alert" className="mb-3 rounded border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-800">
          {error}
        </div>
      )}
      <div className={`flex gap-3 overflow-x-auto pb-4 ${pending ? "opacity-90" : ""}`}>
        {stages.map((s) => {
          const col = cards.filter((c) => c.stage === s.value);
          const total = col.reduce((sum, c) => sum + (c.amount ?? 0), 0);
          return (
            <div
              key={s.value}
              onDragOver={(e) => {
                e.preventDefault();
                setOver(s.value);
              }}
              onDragLeave={() => setOver((o) => (o === s.value ? null : o))}
              onDrop={(e) => {
                e.preventDefault();
                setOver(null);
                const id = e.dataTransfer.getData("text/plain") || dragId;
                if (id) move(id, s.value);
              }}
              className={`flex w-64 shrink-0 flex-col rounded-md border bg-gray-100 ${
                over === s.value ? "border-brand ring-2 ring-brand/30" : "border-line"
              }`}
            >
              <div className="border-b border-line bg-white px-3 py-2">
                <p className="text-sm font-semibold">
                  {s.label} <span className="text-muted">({col.length})</span>
                </p>
                <p className="text-xs text-muted">{fmt(total)}</p>
              </div>
              <div className="flex min-h-40 flex-1 flex-col gap-2 p-2">
                {col.map((c) => (
                  <div
                    key={c.id}
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData("text/plain", c.id);
                      e.dataTransfer.effectAllowed = "move";
                      setDragId(c.id);
                    }}
                    onDragEnd={() => setDragId(null)}
                    className={`card cursor-grab p-3 active:cursor-grabbing ${dragId === c.id ? "opacity-50" : ""}`}
                  >
                    <Link href={`/opportunities/${c.id}`} className="link block text-sm font-medium">
                      {c.name}
                    </Link>
                    {c.account && <p className="truncate text-xs text-muted">{c.account}</p>}
                    <div className="mt-2 flex items-center justify-between text-xs">
                      <span className="font-semibold">{c.amount != null ? fmt(c.amount) : "—"}</span>
                      <span className="text-muted">{fmtDate(c.closeDate)}</span>
                    </div>
                    <select
                      aria-label="Move to stage"
                      className="mt-2 w-full rounded border border-line bg-white px-1 py-0.5 text-xs text-muted md:hidden"
                      value={c.stage}
                      onChange={(e) => move(c.id, e.target.value)}
                    >
                      {stages.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
