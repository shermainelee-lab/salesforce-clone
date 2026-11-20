export function ErrorAlert({ message }: { message?: string | null }) {
  if (!message) return null;
  return (
    <div role="alert" className="mb-4 rounded border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-800">
      <strong className="font-semibold">Error: </strong>
      {message}
    </div>
  );
}

export function param(v: string | string[] | undefined): string | undefined {
  return typeof v === "string" ? v : undefined;
}
