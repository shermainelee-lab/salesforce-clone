import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-[60vh] flex-col items-center justify-center gap-3 p-8 text-center">
      <p className="text-5xl font-bold text-brand">404</p>
      <h1 className="text-lg font-semibold">We couldn&apos;t find that page or record</h1>
      <p className="text-sm text-muted">It may have been deleted, or you followed an old link.</p>
      <Link href="/" className="btn-primary mt-2">
        Back to Home
      </Link>
    </main>
  );
}
