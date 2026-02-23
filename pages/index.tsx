import Link from "next/link";

export default function HomePage() {
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col justify-center">
      <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">Meomul Frontend</p>
      <h1 className="mt-4 text-4xl font-semibold text-slate-900 sm:text-5xl">Pages Router + Role-Aware Platform</h1>
      <p className="mt-4 max-w-2xl text-base text-slate-600 sm:text-lg">
        Authentication, route guards, dashboard role sections, and public hotel browsing are integrated with your GraphQL backend.
      </p>

      <div className="mt-10 flex flex-wrap gap-3">
        <Link
          href="/hotels"
          className="rounded-lg bg-slate-900 px-5 py-3 text-sm font-medium text-white transition hover:bg-slate-700"
        >
          Browse hotels
        </Link>
        <Link
          href="/bookings/new"
          className="rounded-lg border border-slate-300 px-5 py-3 text-sm font-medium text-slate-800 transition hover:border-slate-500"
        >
          Start booking
        </Link>
        <Link
          href="/dashboard"
          className="rounded-lg border border-slate-300 px-5 py-3 text-sm font-medium text-slate-800 transition hover:border-slate-500"
        >
          Open dashboard
        </Link>
        <Link
          href="/auth/login"
          className="rounded-lg border border-slate-300 px-5 py-3 text-sm font-medium text-slate-800 transition hover:border-slate-500"
        >
          Login
        </Link>
      </div>
    </main>
  );
}
