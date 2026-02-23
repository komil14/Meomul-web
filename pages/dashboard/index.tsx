import { useQuery } from "@apollo/client/react";
import Link from "next/link";
import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import { CHECK_AUTH_QUERY } from "@/graphql/auth.gql";
import { clearAuthSession, getSessionMember } from "@/lib/auth/session";
import type { CheckAuthQueryData, SessionMember } from "@/types/auth";

export default function DashboardPage() {
  const router = useRouter();
  const [member, setMember] = useState<SessionMember | null>(null);

  useEffect(() => {
    const sessionMember = getSessionMember();

    if (!sessionMember) {
      void router.replace("/auth/login");
      return;
    }

    setMember(sessionMember);
  }, [router]);

  const { data, loading, error } = useQuery<CheckAuthQueryData>(CHECK_AUTH_QUERY, {
    skip: !member,
    fetchPolicy: "network-only",
  });

  const logout = async () => {
    clearAuthSession();
    await router.push("/auth/login");
  };

  if (!member) {
    return <main className="mx-auto min-h-screen max-w-5xl px-6 py-12">Loading session...</main>;
  }

  return (
    <main className="mx-auto min-h-screen w-full max-w-5xl px-6 py-12">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-6">
        <div>
          <p className="text-sm font-medium uppercase tracking-[0.15em] text-slate-500">Dashboard</p>
          <h1 className="mt-2 text-3xl font-semibold text-slate-900">Welcome, {member.memberNick}</h1>
        </div>
        <button
          onClick={() => {
            void logout();
          }}
          className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-500"
        >
          Logout
        </button>
      </div>

      <section className="mt-8 grid gap-4 rounded-2xl border border-slate-200 bg-white p-5">
        <h2 className="text-lg font-semibold text-slate-900">Session Info</h2>
        <p className="text-sm text-slate-700">
          <span className="font-medium">Role:</span> {member.memberType}
        </p>
        <p className="text-sm text-slate-700">
          <span className="font-medium">Phone:</span> {member.memberPhone}
        </p>
        <p className="text-sm text-slate-700">
          <span className="font-medium">Auth Type:</span> {member.memberAuthType}
        </p>
      </section>

      <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-5">
        <h2 className="text-lg font-semibold text-slate-900">Backend Auth Check</h2>
        {loading ? <p className="mt-2 text-sm text-slate-600">Verifying token against backend...</p> : null}
        {error ? <p className="mt-2 text-sm text-red-600">{error.message}</p> : null}
        {data?.checkAuth ? <p className="mt-2 text-sm text-emerald-700">{data.checkAuth}</p> : null}
      </section>

      <Link href="/" className="mt-8 inline-block text-sm text-slate-600 underline underline-offset-4">
        Back to home
      </Link>
    </main>
  );
}
