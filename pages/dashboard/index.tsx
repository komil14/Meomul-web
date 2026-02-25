import { useQuery } from "@apollo/client/react";
import Link from "next/link";
import { useRouter } from "next/router";
import { useMemo } from "react";
import { ErrorNotice } from "@/components/ui/error-notice";
import { HotelCard } from "@/components/hotels/hotel-card";
import { CHECK_AUTH_QUERY } from "@/graphql/auth.gql";
import { GET_MY_UNREAD_CHAT_COUNT_QUERY } from "@/graphql/chat.gql";
import {
  GET_AGENT_HOTELS_QUERY,
  GET_DASHBOARD_STATS_QUERY,
  GET_HOTELS_QUERY,
} from "@/graphql/hotel.gql";
import { clearAuthSession, getSessionMember } from "@/lib/auth/session";
import { getErrorMessage } from "@/lib/utils/error";
import type { CheckAuthQueryData } from "@/types/auth";
import type { GetMyUnreadChatCountQueryData } from "@/types/chat";
import type {
  GetAgentHotelsQueryData,
  GetAgentHotelsQueryVars,
  GetDashboardStatsQueryData,
  GetHotelsQueryData,
  GetHotelsQueryVars,
  PaginationInput,
} from "@/types/hotel";
import type { NextPageWithAuth } from "@/types/page";

const DASHBOARD_LIST_INPUT: PaginationInput = {
  page: 1,
  limit: 6,
  sort: "createdAt",
  direction: -1,
};

interface StatTileProps {
  label: string;
  value: number;
}

function StatTile({ label, value }: StatTileProps) {
  return (
    <article className="rounded-xl border border-slate-200 bg-white p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.15em] text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-slate-900">{value.toLocaleString()}</p>
    </article>
  );
}

const DashboardPage: NextPageWithAuth = () => {
  const router = useRouter();
  const member = useMemo(() => getSessionMember(), []);

  const memberType = member?.memberType;
  const isUser = memberType === "USER";
  const isAgent = memberType === "AGENT";
  const isAdminArea = memberType === "ADMIN" || memberType === "ADMIN_OPERATOR";

  const { data: authData, loading: authLoading, error: authError } = useQuery<CheckAuthQueryData>(CHECK_AUTH_QUERY, {
    fetchPolicy: "network-only",
  });

  const {
    data: userHotelsData,
    loading: userHotelsLoading,
    error: userHotelsError,
  } = useQuery<GetHotelsQueryData, GetHotelsQueryVars>(GET_HOTELS_QUERY, {
    skip: !isUser,
    variables: { input: DASHBOARD_LIST_INPUT },
    fetchPolicy: "cache-and-network",
  });

  const {
    data: agentHotelsData,
    loading: agentHotelsLoading,
    error: agentHotelsError,
  } = useQuery<GetAgentHotelsQueryData, GetAgentHotelsQueryVars>(GET_AGENT_HOTELS_QUERY, {
    skip: !isAgent,
    variables: { input: DASHBOARD_LIST_INPUT },
    fetchPolicy: "cache-and-network",
  });

  const {
    data: dashboardStatsData,
    loading: dashboardStatsLoading,
    error: dashboardStatsError,
  } = useQuery<GetDashboardStatsQueryData>(GET_DASHBOARD_STATS_QUERY, {
    skip: !isAdminArea,
    fetchPolicy: "network-only",
  });

  const {
    data: unreadChatData,
    loading: unreadChatLoading,
    error: unreadChatError,
  } = useQuery<GetMyUnreadChatCountQueryData>(GET_MY_UNREAD_CHAT_COUNT_QUERY, {
    skip: !member,
    fetchPolicy: "cache-and-network",
    nextFetchPolicy: "cache-first",
  });

  const logout = async () => {
    clearAuthSession();
    await router.push("/auth/login");
  };

  const userHotels = userHotelsData?.getHotels.list ?? [];
  const agentHotels = agentHotelsData?.getAgentHotels.list ?? [];
  const stats = dashboardStatsData?.getDashboardStats;

  return (
    <main className="mx-auto w-full max-w-5xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-6">
        <div>
          <p className="text-sm font-medium uppercase tracking-[0.15em] text-slate-500">Dashboard</p>
          <h1 className="mt-2 text-3xl font-semibold text-slate-900">Welcome, {member?.memberNick ?? "Member"}</h1>
          <p className="mt-2 text-sm text-slate-600">Role: {member?.memberType ?? "Unknown"}</p>
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

      <section className="rounded-2xl border border-slate-200 bg-white p-5">
        <h2 className="text-lg font-semibold text-slate-900">Backend Auth Check</h2>
        {authLoading ? <p className="mt-2 text-sm text-slate-600">Verifying token against backend...</p> : null}
        {authError ? <ErrorNotice className="mt-2" message={getErrorMessage(authError)} /> : null}
        {authData?.checkAuth ? <p className="mt-2 text-sm text-emerald-700">{authData.checkAuth}</p> : null}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Chat Inbox</h2>
            {unreadChatLoading ? <p className="mt-2 text-sm text-slate-600">Loading unread chat count...</p> : null}
            {unreadChatError ? <ErrorNotice className="mt-2" message={getErrorMessage(unreadChatError)} /> : null}
            {!unreadChatLoading && !unreadChatError ? (
              <p className="mt-2 text-sm text-slate-700">
                Unread chat messages:{" "}
                <span className="font-semibold">{(unreadChatData?.getMyUnreadChatCount ?? 0).toLocaleString()}</span>
              </p>
            ) : null}
          </div>
          <Link href="/chats" className="text-sm font-semibold text-slate-700 underline underline-offset-4">
            Open chats
          </Link>
        </div>
      </section>

      {isUser ? (
        <section className="space-y-4 rounded-2xl border border-emerald-200 bg-emerald-50/50 p-5">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">User Section</h2>
              <p className="text-sm text-slate-600">Quick browse of public hotels.</p>
            </div>
            <Link href="/hotels" className="text-sm font-semibold text-emerald-700 underline underline-offset-4">
              View all hotels
            </Link>
          </div>

          {userHotelsError ? <ErrorNotice message={getErrorMessage(userHotelsError)} /> : null}
          {userHotelsLoading && userHotels.length === 0 ? <p className="text-sm text-slate-600">Loading hotels...</p> : null}
          {userHotels.length > 0 ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {userHotels.map((hotel) => (
                <HotelCard key={hotel._id} hotel={hotel} />
              ))}
            </div>
          ) : null}
        </section>
      ) : null}

      {isAgent ? (
        <section className="space-y-4 rounded-2xl border border-sky-200 bg-sky-50/50 p-5">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Agent Section</h2>
              <p className="text-sm text-slate-600">Your managed hotels snapshot.</p>
            </div>
          </div>

          {agentHotelsError ? <ErrorNotice message={getErrorMessage(agentHotelsError)} /> : null}
          {agentHotelsLoading && agentHotels.length === 0 ? (
            <p className="text-sm text-slate-600">Loading your hotels...</p>
          ) : null}
          {!agentHotelsLoading && agentHotels.length === 0 ? (
            <p className="text-sm text-slate-600">No managed hotels found for your account.</p>
          ) : null}
          {agentHotels.length > 0 ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {agentHotels.map((hotel) => (
                <HotelCard key={hotel._id} hotel={hotel} />
              ))}
            </div>
          ) : null}
        </section>
      ) : null}

      {isAdminArea ? (
        <section className="space-y-4 rounded-2xl border border-violet-200 bg-violet-50/40 p-5">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Admin Section</h2>
            <p className="text-sm text-slate-600">Live operational metrics for platform health.</p>
          </div>

          {dashboardStatsError ? <ErrorNotice message={getErrorMessage(dashboardStatsError)} /> : null}
          {dashboardStatsLoading && !stats ? <p className="text-sm text-slate-600">Loading dashboard stats...</p> : null}

          {stats ? (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <StatTile label="Total Members" value={stats.totalMembers} />
              <StatTile label="Total Hotels" value={stats.totalHotels} />
              <StatTile label="Total Bookings" value={stats.totalBookings} />
              <StatTile label="Total Revenue" value={stats.totalRevenue} />
              <StatTile label="Pending Hotels" value={stats.pendingHotels} />
              <StatTile label="Pending Bookings" value={stats.pendingBookings} />
              <StatTile label="New Bookings Today" value={stats.newBookingsToday} />
              <StatTile label="Today Revenue" value={stats.todayRevenue} />
            </div>
          ) : null}
        </section>
      ) : null}

      <div className="flex gap-3 pt-2">
        <Link href="/hotels" className="text-sm text-slate-600 underline underline-offset-4">
          Browse hotels
        </Link>
        <Link href="/" className="text-sm text-slate-600 underline underline-offset-4">
          Back to home
        </Link>
      </div>
    </main>
  );
};

DashboardPage.auth = {
  roles: ["USER", "AGENT", "ADMIN", "ADMIN_OPERATOR"],
};

export default DashboardPage;
