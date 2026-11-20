import Link from "next/link";
import type { ReactNode } from "react";
import { requireUser } from "@/lib/supabase/server";
import { NAV_OBJECTS, OBJECTS, titleCase } from "@/lib/objects";
import { NavTabs } from "@/components/NavTabs";

export const dynamic = "force-dynamic";

export default async function CrmLayout({ children }: { children: ReactNode }) {
  const { user, profile } = await requireUser();
  const name: string = profile?.full_name || user.email || "User";
  const initials = name
    .split(/\s+/)
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const tabs = [
    { href: "/", label: "Home" },
    ...NAV_OBJECTS.slice(0, 4).map((k) => ({ href: `/${k}`, label: OBJECTS[k].plural })),
    { href: "/pipeline", label: "Pipeline" },
    ...NAV_OBJECTS.slice(4).map((k) => ({ href: `/${k}`, label: OBJECTS[k].plural })),
  ];

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-20 bg-white shadow-sm">
        <div className="flex items-center gap-4 px-4 py-2">
          <Link href="/" className="flex items-center gap-2" aria-label="Home">
            <svg viewBox="0 0 64 64" className="h-9 w-9" aria-hidden>
              <path
                fill="#0176d3"
                d="M26.6 14.2a12 12 0 0 1 19 2.6 14.3 14.3 0 0 1 18.4 13.7 14.3 14.3 0 0 1-17.1 14 10.6 10.6 0 0 1-13.8 4.5 12 12 0 0 1-22.3-.8A11 11 0 0 1 3.3 28.9a12.6 12.6 0 0 1 23.3-14.7Z"
              />
            </svg>
          </Link>
          <form action="/search" className="mx-auto w-full max-w-xl">
            <input
              name="q"
              type="search"
              placeholder="Search accounts, contacts, leads, opportunities…"
              className="input rounded-full bg-gray-50"
              aria-label="Global search"
            />
          </form>
          <details className="relative">
            <summary className="flex cursor-pointer list-none items-center gap-2" title={name}>
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-dark text-xs font-bold text-white">
                {initials}
              </span>
            </summary>
            <div className="card absolute right-0 z-30 mt-2 w-60 p-3 text-sm">
              <p className="font-semibold">{name}</p>
              <p className="truncate text-muted">{user.email}</p>
              {profile && <p className="mt-1 text-xs text-muted">Role: {titleCase(profile.role)}</p>}
              <hr className="my-2 border-line" />
              <Link className="block py-1 link" href={`/users/${user.id}`}>
                My profile
              </Link>
              <Link className="block py-1 link" href="/users">
                Setup · Users
              </Link>
              <form action="/auth/signout" method="post">
                <button className="mt-1 py-1 text-left link" type="submit">
                  Log out
                </button>
              </form>
            </div>
          </details>
        </div>
        <div className="flex items-stretch border-t border-line px-4">
          <span className="mr-4 flex items-center border-r border-line pr-4 text-base font-semibold">Sales</span>
          <NavTabs tabs={tabs} />
        </div>
      </header>
      <main className="mx-auto w-full max-w-[1400px] flex-1 p-4">{children}</main>
    </div>
  );
}
