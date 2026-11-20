import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { supabaseEnv } from "./env";

export async function createClient() {
  const cookieStore = await cookies();
  const { url, key } = supabaseEnv();

  return createServerClient(url, key, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Called from a Server Component — the middleware refreshes sessions, so this is safe to ignore.
        }
      },
    },
  });
}

export type Profile = {
  id: string;
  email: string;
  full_name: string | null;
  title: string | null;
  role: "admin" | "manager" | "sales_rep" | "support_agent";
  is_active: boolean;
};

/** Signed-in user + profile, or redirect to /login. Cached per request. */
export const requireUser = cache(async () => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, email, full_name, title, role, is_active")
    .eq("id", user.id)
    .single();

  return { supabase, user, profile: profile as unknown as Profile | null };
});
