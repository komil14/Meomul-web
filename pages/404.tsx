import Link from "next/link";
import Head from "next/head";

export default function NotFoundPage() {
  return (
    <>
      <Head>
        <title>Page Not Found — Meomul</title>
      </Head>

      <main className="mx-auto flex min-h-[50vh] w-full max-w-2xl flex-col items-center justify-center rounded-2xl border border-slate-200 bg-white p-8 text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
          Page not found
        </p>
        <h1 className="mt-3 text-3xl font-semibold text-slate-900">
          404 — Not Found
        </h1>
        <p className="mt-3 max-w-md text-sm text-slate-600">
          Sorry, we couldn&apos;t find the page you&apos;re looking for. It may
          have been moved or no longer exists.
        </p>
        <div className="mt-6 flex gap-3">
          <Link
            href="/hotels"
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800"
          >
            Browse hotels
          </Link>
          <Link
            href="/"
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-400"
          >
            Go home
          </Link>
        </div>
      </main>
    </>
  );
}
