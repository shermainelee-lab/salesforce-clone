import Link from "next/link";
import { signIn, signUp } from "./actions";
import { SubmitButton } from "@/components/SubmitButton";

export const metadata = { title: "Login" };

type SP = Promise<Record<string, string | string[] | undefined>>;

export default async function LoginPage({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const mode = sp.mode === "signup" ? "signup" : "signin";
  const error = typeof sp.error === "string" ? sp.error : null;
  const message = typeof sp.message === "string" ? sp.message : null;
  const next = typeof sp.next === "string" ? sp.next : "/";

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-linear-to-b from-brand-light to-page px-4">
      <div className="mb-6 flex items-center gap-2">
        <svg viewBox="0 0 64 64" className="h-12 w-12" aria-hidden>
          <path
            fill="#0176d3"
            d="M26.6 14.2a12 12 0 0 1 19 2.6 14.3 14.3 0 0 1 18.4 13.7 14.3 14.3 0 0 1-17.1 14 10.6 10.6 0 0 1-13.8 4.5 12 12 0 0 1-22.3-.8A11 11 0 0 1 3.3 28.9a12.6 12.6 0 0 1 23.3-14.7Z"
          />
        </svg>
        <span className="text-2xl font-semibold text-brand-dark">Salesforce Clone</span>
      </div>

      <div className="card w-full max-w-sm p-6">
        <h1 className="mb-4 text-lg font-semibold">{mode === "signup" ? "Create your account" : "Log in"}</h1>

        {error && <p className="mb-4 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
        {message && (
          <p className="mb-4 rounded border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800">{message}</p>
        )}

        <form action={mode === "signup" ? signUp : signIn} className="space-y-4">
          <input type="hidden" name="next" value={next} />
          {mode === "signup" && (
            <div>
              <label className="label" htmlFor="full_name">Full name</label>
              <input id="full_name" name="full_name" className="input" autoComplete="name" required />
            </div>
          )}
          <div>
            <label className="label" htmlFor="email">Email</label>
            <input id="email" name="email" type="email" className="input" autoComplete="email" required />
          </div>
          <div>
            <label className="label" htmlFor="password">Password</label>
            <input
              id="password"
              name="password"
              type="password"
              className="input"
              minLength={6}
              autoComplete={mode === "signup" ? "new-password" : "current-password"}
              required
            />
          </div>
          <SubmitButton className="btn-primary w-full py-2">{mode === "signup" ? "Sign up" : "Log in"}</SubmitButton>
        </form>

        <p className="mt-4 text-center text-sm text-muted">
          {mode === "signup" ? (
            <>
              Already have an account? <Link className="link" href="/login">Log in</Link>
            </>
          ) : (
            <>
              New here? <Link className="link" href="/login?mode=signup">Create an account</Link>
            </>
          )}
        </p>
      </div>
      <p className="mt-6 max-w-sm text-center text-xs text-muted">
        The first person to sign up becomes the org administrator.
      </p>
    </main>
  );
}
