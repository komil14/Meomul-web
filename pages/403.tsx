import Link from "next/link";

export default function ForbiddenPage() {
  return (
    <main className="mx-auto flex min-h-[50vh] w-full max-w-2xl flex-col items-center justify-center rounded-2xl border border-rose-200 bg-white p-8 text-center">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-rose-500">Access denied</p>
      <h1 className="mt-3 text-3xl font-semibold text-slate-900">403 - Forbidden</h1>
      <p className="mt-3 text-sm text-slate-600">
        Your account role does not have permission to open this page.
      </p>
      <div className="mt-6 flex gap-3">
        <Link href="/dashboard" className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white">
          Go to dashboard
        </Link>
        <Link href="/" className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700">
          Go home
        </Link>
      </div>
    </main>
  );
}
