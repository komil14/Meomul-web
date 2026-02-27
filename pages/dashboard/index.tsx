import { useQuery } from "@apollo/client/react";
import Link from "next/link";
import { useRouter } from "next/router";
import { useEffect, useMemo, useRef, useState } from "react";
import { ErrorNotice } from "@/components/ui/error-notice";
import { HotelCard } from "@/components/hotels/hotel-card";
import { CHECK_AUTH_QUERY } from "@/graphql/auth.gql";
import { GET_ANALYTICS_EVENTS_ADMIN_QUERY } from "@/graphql/analytics.gql";
import {
  GET_AGENT_HOTELS_QUERY,
  GET_DASHBOARD_STATS_QUERY,
  GET_HOTELS_QUERY,
} from "@/graphql/hotel.gql";
import { clearAuthSession, getSessionMember } from "@/lib/auth/session";
import { usePageVisible } from "@/lib/hooks/use-page-visible";
import { getErrorMessage } from "@/lib/utils/error";
import { formatNumber } from "@/lib/utils/format";
import type { CheckAuthQueryData } from "@/types/auth";
import type { MemberType } from "@/types/auth";
import type {
  AnalyticsEventSearchInput,
  GetAnalyticsEventsAdminQueryData,
  GetAnalyticsEventsAdminQueryVars,
} from "@/types/analytics";
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
const ANALYTICS_LIST_LIMIT = 12;
const DASHBOARD_REFRESH_COOLDOWN_MS = 60000;

interface AnalyticsFilterFormState {
  eventName: string;
  memberId: string;
  memberType: "" | MemberType;
  source: string;
  fromDate: string;
  toDate: string;
}

const INITIAL_ANALYTICS_FILTERS: AnalyticsFilterFormState = {
  eventName: "",
  memberId: "",
  memberType: "",
  source: "",
  fromDate: "",
  toDate: "",
};

interface StatTileProps {
  label: string;
  value: number;
}

function StatTile({ label, value }: StatTileProps) {
  return (
    <article className="rounded-xl border border-slate-200 bg-white p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.15em] text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-slate-900">{formatNumber(value)}</p>
    </article>
  );
}

const DashboardPage: NextPageWithAuth = () => {
  const router = useRouter();
  const member = useMemo(() => getSessionMember(), []);
  const isPageVisible = usePageVisible();
  const hasVisibilityMountedRef = useRef(false);
  const wasVisibleRef = useRef(false);
  const lastRefreshAtRef = useRef(0);
  const [analyticsPage, setAnalyticsPage] = useState(1);
  const [analyticsDraftFilters, setAnalyticsDraftFilters] = useState<AnalyticsFilterFormState>(
    INITIAL_ANALYTICS_FILTERS,
  );
  const [analyticsAppliedFilters, setAnalyticsAppliedFilters] = useState<AnalyticsFilterFormState>(
    INITIAL_ANALYTICS_FILTERS,
  );

  const memberType = member?.memberType;
  const isUser = memberType === "USER";
  const isAgent = memberType === "AGENT";
  const isAdminArea = memberType === "ADMIN" || memberType === "ADMIN_OPERATOR";

  const analyticsSearch = useMemo<AnalyticsEventSearchInput | undefined>(() => {
    if (!isAdminArea) {
      return undefined;
    }

    const eventName = analyticsAppliedFilters.eventName.trim();
    const memberId = analyticsAppliedFilters.memberId.trim();
    const source = analyticsAppliedFilters.source.trim();

    const search: AnalyticsEventSearchInput = {};

    if (eventName) {
      search.eventName = eventName;
    }
    if (memberId) {
      search.memberId = memberId;
    }
    if (analyticsAppliedFilters.memberType) {
      search.memberType = analyticsAppliedFilters.memberType;
    }
    if (source) {
      search.source = source;
    }
    if (analyticsAppliedFilters.fromDate) {
      search.fromDate = analyticsAppliedFilters.fromDate;
    }
    if (analyticsAppliedFilters.toDate) {
      search.toDate = analyticsAppliedFilters.toDate;
    }

    return Object.keys(search).length > 0 ? search : undefined;
  }, [analyticsAppliedFilters, isAdminArea]);

  const {
    data: authData,
    loading: authLoading,
    error: authError,
    refetch: refetchAuth,
  } = useQuery<CheckAuthQueryData>(CHECK_AUTH_QUERY, {
    fetchPolicy: "cache-first",
    nextFetchPolicy: "cache-first",
  });

  const {
    data: userHotelsData,
    loading: userHotelsLoading,
    error: userHotelsError,
  } = useQuery<GetHotelsQueryData, GetHotelsQueryVars>(GET_HOTELS_QUERY, {
    skip: !isUser,
    variables: { input: DASHBOARD_LIST_INPUT },
    fetchPolicy: "cache-first",
    nextFetchPolicy: "cache-first",
  });

  const {
    data: agentHotelsData,
    loading: agentHotelsLoading,
    error: agentHotelsError,
  } = useQuery<GetAgentHotelsQueryData, GetAgentHotelsQueryVars>(GET_AGENT_HOTELS_QUERY, {
    skip: !isAgent,
    variables: { input: DASHBOARD_LIST_INPUT },
    fetchPolicy: "cache-first",
    nextFetchPolicy: "cache-first",
  });

  const {
    data: dashboardStatsData,
    loading: dashboardStatsLoading,
    error: dashboardStatsError,
    refetch: refetchDashboardStats,
  } = useQuery<GetDashboardStatsQueryData>(GET_DASHBOARD_STATS_QUERY, {
    skip: !isAdminArea,
    fetchPolicy: "cache-first",
    nextFetchPolicy: "cache-first",
  });

  const {
    data: analyticsEventsData,
    loading: analyticsEventsLoading,
    error: analyticsEventsError,
    refetch: refetchAnalyticsEvents,
  } = useQuery<GetAnalyticsEventsAdminQueryData, GetAnalyticsEventsAdminQueryVars>(GET_ANALYTICS_EVENTS_ADMIN_QUERY, {
    skip: !isAdminArea,
    variables: {
      input: {
        page: analyticsPage,
        limit: ANALYTICS_LIST_LIMIT,
        sort: "createdAt",
        direction: -1,
      },
      ...(analyticsSearch ? { search: analyticsSearch } : {}),
    },
    fetchPolicy: "cache-first",
    nextFetchPolicy: "cache-first",
  });

  const logout = async () => {
    clearAuthSession();
    await router.push("/auth/login");
  };

  useEffect(() => {
    if (!isPageVisible) {
      wasVisibleRef.current = false;
      return;
    }

    const becameVisible = !wasVisibleRef.current;
    wasVisibleRef.current = true;
    if (!hasVisibilityMountedRef.current) {
      hasVisibilityMountedRef.current = true;
      return;
    }
    if (!becameVisible) {
      return;
    }

    const nowMs = Date.now();
    if (nowMs - lastRefreshAtRef.current < DASHBOARD_REFRESH_COOLDOWN_MS) {
      return;
    }
    lastRefreshAtRef.current = nowMs;

    void refetchAuth();
    if (isAdminArea) {
      void refetchDashboardStats();
      void refetchAnalyticsEvents();
    }
  }, [isAdminArea, isPageVisible, refetchAnalyticsEvents, refetchAuth, refetchDashboardStats]);

  const userHotels = userHotelsData?.getHotels.list ?? [];
  const agentHotels = agentHotelsData?.getAgentHotels.list ?? [];
  const stats = dashboardStatsData?.getDashboardStats;
  const analyticsEvents = analyticsEventsData?.getAnalyticsEventsAdmin.list ?? [];
  const analyticsTotal = analyticsEventsData?.getAnalyticsEventsAdmin.metaCounter.total ?? 0;
  const analyticsTotalPages = Math.max(1, Math.ceil(analyticsTotal / ANALYTICS_LIST_LIMIT));

  const applyAnalyticsFilters = () => {
    setAnalyticsPage(1);
    setAnalyticsAppliedFilters(analyticsDraftFilters);
  };

  const resetAnalyticsFilters = () => {
    setAnalyticsPage(1);
    setAnalyticsDraftFilters(INITIAL_ANALYTICS_FILTERS);
    setAnalyticsAppliedFilters(INITIAL_ANALYTICS_FILTERS);
  };

  const handleAnalyticsPageChange = (nextPage: number) => {
    if (nextPage < 1 || nextPage > analyticsTotalPages) {
      return;
    }
    setAnalyticsPage(nextPage);
  };

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
            <p className="mt-2 text-sm text-slate-700">
              Unread message count is shown in the top navigation chat badge.
            </p>
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
              {userHotels.map((hotel, index) => (
                <HotelCard
                  key={hotel._id}
                  hotel={hotel}
                  imagePriority={index < 2}
                  imageSizes="(max-width: 639px) 100vw, (max-width: 1023px) 50vw, (max-width: 1279px) 33vw, 22rem"
                />
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
              {agentHotels.map((hotel, index) => (
                <HotelCard
                  key={hotel._id}
                  hotel={hotel}
                  imagePriority={index < 2}
                  imageSizes="(max-width: 639px) 100vw, (max-width: 1023px) 50vw, (max-width: 1279px) 33vw, 22rem"
                />
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

          <section className="space-y-4 rounded-xl border border-violet-200 bg-white/80 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-base font-semibold text-slate-900">Onboarding Analytics Events</h3>
              <p className="text-xs font-medium uppercase tracking-[0.12em] text-slate-500">Total {analyticsTotal}</p>
            </div>

            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              <label className="space-y-1 text-sm">
                <span className="font-medium text-slate-700">Event name</span>
                <input
                  value={analyticsDraftFilters.eventName}
                  onChange={(event) =>
                    setAnalyticsDraftFilters((prev) => ({ ...prev, eventName: event.target.value }))
                  }
                  placeholder="onboarding_completed"
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-slate-500"
                />
              </label>

              <label className="space-y-1 text-sm">
                <span className="font-medium text-slate-700">Member ID</span>
                <input
                  value={analyticsDraftFilters.memberId}
                  onChange={(event) =>
                    setAnalyticsDraftFilters((prev) => ({ ...prev, memberId: event.target.value }))
                  }
                  placeholder="Mongo ObjectId"
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono text-sm text-slate-900 outline-none transition focus:border-slate-500"
                />
              </label>

              <label className="space-y-1 text-sm">
                <span className="font-medium text-slate-700">Member type</span>
                <select
                  value={analyticsDraftFilters.memberType}
                  onChange={(event) =>
                    setAnalyticsDraftFilters((prev) => ({
                      ...prev,
                      memberType: event.target.value as AnalyticsFilterFormState["memberType"],
                    }))
                  }
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-slate-500"
                >
                  <option value="">All</option>
                  <option value="USER">USER</option>
                  <option value="AGENT">AGENT</option>
                  <option value="ADMIN">ADMIN</option>
                  <option value="ADMIN_OPERATOR">ADMIN_OPERATOR</option>
                </select>
              </label>

              <label className="space-y-1 text-sm">
                <span className="font-medium text-slate-700">Source</span>
                <input
                  value={analyticsDraftFilters.source}
                  onChange={(event) => setAnalyticsDraftFilters((prev) => ({ ...prev, source: event.target.value }))}
                  placeholder="web"
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-slate-500"
                />
              </label>

              <label className="space-y-1 text-sm">
                <span className="font-medium text-slate-700">From date</span>
                <input
                  type="date"
                  value={analyticsDraftFilters.fromDate}
                  onChange={(event) =>
                    setAnalyticsDraftFilters((prev) => ({ ...prev, fromDate: event.target.value }))
                  }
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-slate-500"
                />
              </label>

              <label className="space-y-1 text-sm">
                <span className="font-medium text-slate-700">To date</span>
                <input
                  type="date"
                  value={analyticsDraftFilters.toDate}
                  onChange={(event) => setAnalyticsDraftFilters((prev) => ({ ...prev, toDate: event.target.value }))}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-slate-500"
                />
              </label>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={applyAnalyticsFilters}
                className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-700"
              >
                Apply filters
              </button>
              <button
                type="button"
                onClick={resetAnalyticsFilters}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-500"
              >
                Reset
              </button>
            </div>

            {analyticsEventsError ? <ErrorNotice message={getErrorMessage(analyticsEventsError)} /> : null}
            {analyticsEventsLoading && analyticsEvents.length === 0 ? (
              <p className="text-sm text-slate-600">Loading analytics events...</p>
            ) : null}
            {!analyticsEventsLoading && analyticsEvents.length === 0 ? (
              <p className="text-sm text-slate-600">No analytics events found for the selected filters.</p>
            ) : null}

            {analyticsEvents.length > 0 ? (
              <div className="overflow-hidden rounded-lg border border-slate-200">
                <div className="overflow-x-auto">
                  <table className="min-w-full text-left text-xs text-slate-700">
                    <thead className="bg-slate-100 text-[11px] uppercase tracking-[0.12em] text-slate-600">
                      <tr>
                        <th className="px-3 py-2">When</th>
                        <th className="px-3 py-2">Event</th>
                        <th className="px-3 py-2">Member</th>
                        <th className="px-3 py-2">Path</th>
                        <th className="px-3 py-2">Source</th>
                        <th className="px-3 py-2">Payload</th>
                      </tr>
                    </thead>
                    <tbody>
                      {analyticsEvents.map((eventItem) => (
                        <tr key={eventItem._id} className="border-t border-slate-200 bg-white">
                          <td className="whitespace-nowrap px-3 py-2 font-medium text-slate-900">
                            {new Date(eventItem.createdAt).toLocaleString()}
                          </td>
                          <td className="whitespace-nowrap px-3 py-2">{eventItem.eventName}</td>
                          <td className="px-3 py-2">
                            <p className="font-medium text-slate-800">{eventItem.memberType}</p>
                            <p className="font-mono text-[11px] text-slate-500">{eventItem.memberId}</p>
                          </td>
                          <td className="px-3 py-2">{eventItem.eventPath ?? "-"}</td>
                          <td className="whitespace-nowrap px-3 py-2">{eventItem.source ?? "-"}</td>
                          <td className="max-w-[26rem] px-3 py-2 text-slate-600">
                            {eventItem.payload ? (
                              eventItem.payload.length > 180 ? (
                                `${eventItem.payload.slice(0, 180)}...`
                              ) : (
                                eventItem.payload
                              )
                            ) : (
                              "-"
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : null}

            {analyticsTotal > 0 ? (
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs text-slate-600">
                  Page {analyticsPage} / {analyticsTotalPages}
                </p>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={analyticsPage <= 1}
                    onClick={() => handleAnalyticsPageChange(analyticsPage - 1)}
                    className="rounded-md border border-slate-300 px-3 py-1 text-xs font-semibold text-slate-700 transition hover:border-slate-500 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Prev
                  </button>
                  <button
                    type="button"
                    disabled={analyticsPage >= analyticsTotalPages}
                    onClick={() => handleAnalyticsPageChange(analyticsPage + 1)}
                    className="rounded-md border border-slate-300 px-3 py-1 text-xs font-semibold text-slate-700 transition hover:border-slate-500 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Next
                  </button>
                </div>
              </div>
            ) : null}
          </section>
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
