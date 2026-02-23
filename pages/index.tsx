import Link from "next/link";

export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-5xl flex-col justify-center px-6 py-12">
      <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">
        Meomul Frontend
      </p>
      <h1 className="mt-4 text-4xl font-semibold text-slate-900 sm:text-5xl">
        Next.js Pages Router Baseline
      </h1>
      <p className="mt-4 max-w-2xl text-base text-slate-600 sm:text-lg">
        Auth foundation is ready with Apollo Client, bearer token storage, and role-aware session typing.
      </p>

      <div className="mt-10 flex flex-wrap gap-3">
        <Link
          href="/auth/login"
          className="rounded-lg bg-slate-900 px-5 py-3 text-sm font-medium text-white transition hover:bg-slate-700"
        >
          Login
        </Link>
        <Link
          href="/auth/signup"
          className="rounded-lg border border-slate-300 px-5 py-3 text-sm font-medium text-slate-800 transition hover:border-slate-500"
        >
          Signup
        </Link>
        <Link
          href="/auth/forgot-password"
          className="rounded-lg border border-slate-300 px-5 py-3 text-sm font-medium text-slate-800 transition hover:border-slate-500"
        >
          Forgot Password
        </Link>
        <Link
          href="/dashboard"
          className="rounded-lg border border-slate-300 px-5 py-3 text-sm font-medium text-slate-800 transition hover:border-slate-500"
        >
          Dashboard
        </Link>
      </div>
    </main>
  );
}
