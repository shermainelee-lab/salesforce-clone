"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function NavTabs({ tabs }: { tabs: { href: string; label: string }[] }) {
  const pathname = usePathname();
  return (
    <nav className="flex min-w-0 items-stretch overflow-x-auto">
      {tabs.map((t) => {
        const active = t.href === "/" ? pathname === "/" : pathname === t.href || pathname.startsWith(t.href + "/");
        return (
          <Link
            key={t.href}
            href={t.href}
            className={`flex items-center border-b-[3px] px-3 py-2.5 text-sm whitespace-nowrap ${
              active ? "border-brand font-semibold text-ink" : "border-transparent text-gray-700 hover:border-gray-300"
            }`}
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
