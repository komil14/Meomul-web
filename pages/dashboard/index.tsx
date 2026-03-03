import { useQuery } from "@apollo/client/react";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { ErrorNotice } from "@/components/ui/error-notice";
import { CHECK_AUTH_QUERY } from "@/graphql/auth.gql";
import { GET_ANALYTICS_EVENTS_ADMIN_QUERY } from "@/graphql/analytics.gql";
import { GET_ALL_BOOKINGS_ADMIN_QUERY } from "@/graphql/booking.gql";
import {
  GET_AGENT_HOTELS_QUERY,
  GET_DASHBOARD_STATS_QUERY,
  GET_HOTELS_QUERY,
} from "@/graphql/hotel.gql";
import { GET_ALL_REVIEWS_ADMIN_QUERY } from "@/graphql/review.gql";
import { getSessionMember } from "@/lib/auth/session";
import { usePageVisible } from "@/lib/hooks/use-page-visible";
import { getErrorMessage } from "@/lib/utils/error";
import { formatNumber } from "@/lib/utils/format";
import type { CheckAuthQueryData, MemberType } from "@/types/auth";
import type {
  AnalyticsEventSearchInput,
  GetAnalyticsEventsAdminQueryData,
  GetAnalyticsEventsAdminQueryVars,
} from "@/types/analytics";
import type {
  BookingStatus,
  GetAllBookingsAdminQueryData,
  GetAllBookingsAdminQueryVars,
} from "@/types/booking";
import type {
  GetAgentHotelsQueryData,
  GetAgentHotelsQueryVars,
  GetAllReviewsAdminQueryData,
  GetAllReviewsAdminQueryVars,
  GetDashboardStatsQueryData,
  GetHotelsQueryData,
  GetHotelsQueryVars,
  HotelListItem,
  PaginationInput,
  ReviewStatus,
} from "@/types/hotel";
import type { NextPageWithAuth } from "@/types/page";
import {
  ArrowDownRight,
  ArrowUpRight,
  BookCheck,
  Building2,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Loader2,
  MessageSquareText,
  RefreshCcw,
  UsersRound,
  Wallet,
} from "lucide-react";

const SEOUL_TIMEZONE = "Asia/Seoul";
const DASHBOARD_REFRESH_COOLDOWN_MS = 60000;
const ANALYTICS_LIST_LIMIT = 10;
const ADMIN_HOTELS_INPUT: PaginationInput = {
  page: 1,
  limit: 120,
  sort: "createdAt",
  direction: -1,
};
const AGENT_HOTELS_INPUT: PaginationInput = {
  page: 1,
  limit: 8,
  sort: "createdAt",
  direction: -1,
};
const ADMIN_BOOKINGS_INPUT: PaginationInput = {
  page: 1,
  limit: 80,
  sort: "createdAt",
  direction: -1,
};
const ADMIN_REVIEWS_INPUT: PaginationInput = {
  page: 1,
  limit: 10,
  sort: "createdAt",
  direction: -1,
};
const WEEK_LABELS = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"] as const;

const BOOKING_STATUS_LABEL: Record<BookingStatus, string> = {
  PENDING: "Pending",
  CONFIRMED: "Confirmed",
  CHECKED_IN: "Checked in",
  CHECKED_OUT: "Checked out",
  CANCELLED: "Cancelled",
  NO_SHOW: "No show",
};

const BOOKING_STATUS_COLOR: Record<BookingStatus, string> = {
  PENDING: "bg-amber-100 text-amber-700",
  CONFIRMED: "bg-sky-100 text-sky-700",
  CHECKED_IN: "bg-emerald-100 text-emerald-700",
  CHECKED_OUT: "bg-indigo-100 text-indigo-700",
  CANCELLED: "bg-rose-100 text-rose-700",
  NO_SHOW: "bg-slate-100 text-slate-700",
};

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

function toDayKey(input: string): string {
  return input.slice(0, 10);
}

function monthStart(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}

function addMonths(date: Date, delta: number): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + delta, 1));
}

function buildCalendarDays(cursor: Date): Date[] {
  const firstOfMonth = monthStart(cursor);
  const weekday = firstOfMonth.getUTCDay();
  const mondayBasedOffset = weekday === 0 ? 6 : weekday - 1;
  const start = new Date(Date.UTC(firstOfMonth.getUTCFullYear(), firstOfMonth.getUTCMonth(), 1 - mondayBasedOffset));
  return Array.from({ length: 42 }, (_, index) => {
    const day = new Date(start);
    day.setUTCDate(start.getUTCDate() + index);
    return day;
  });
}

function formatMonthLabel(date: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

function formatDateShort(value: string): string {
  return new Date(value).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: SEOUL_TIMEZONE,
  });
}

function formatDateTime(value: string): string {
  return new Date(value).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: SEOUL_TIMEZONE,
  });
}

function memberTypeTone(memberType: MemberType): string {
  if (memberType === "ADMIN" || memberType === "ADMIN_OPERATOR") return "bg-rose-100 text-rose-700";
  if (memberType === "AGENT") return "bg-violet-100 text-violet-700";
  return "bg-sky-100 text-sky-700";
}

function RingGauge({ label, value, color }: { label: string; value: number; color: string }) {
  const clamped = Math.max(0, Math.min(100, Math.round(value)));
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-4">
      <div className="flex items-center gap-4">
        <div
          className="relative h-16 w-16 rounded-full"
          style={{ background: `conic-gradient(${color} ${clamped * 3.6}deg, #e2e8f0 0deg)` }}
        >
          <div className="absolute inset-[8px] rounded-full bg-white" />
        </div>
        <div>
          <p className="text-3xl font-semibold text-slate-900">{clamped}%</p>
          <p className="text-sm font-medium text-slate-500">{label}</p>
        </div>
      </div>
    </article>
  );
}

function KpiCard({
  title,
  value,
  deltaText,
  tone,
  icon,
}: {
  title: string;
  value: string;
  deltaText: string;
  tone: "sky" | "emerald" | "amber" | "rose";
  icon: React.ReactNode;
}) {
  const toneClass: Record<typeof tone, string> = {
    sky: "from-sky-500 to-sky-400",
    emerald: "from-emerald-500 to-emerald-400",
    amber: "from-amber-500 to-amber-400",
    rose: "from-rose-500 to-orange-400",
  };
  return (
    <article className={`rounded-2xl bg-gradient-to-br ${toneClass[tone]} p-5 text-white shadow-sm`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-white/80">{title}</p>
          <p className="mt-3 text-3xl font-semibold">{value}</p>
          <p className="mt-2 text-sm text-white/90">{deltaText}</p>
        </div>
        <span className="rounded-xl bg-white/20 p-2.5 text-white">{icon}</span>
      </div>
    </article>
  );
}

const DashboardPage: NextPageWithAuth = () => {
  const member = useMemo(() => getSessionMember(), []);
  const isPageVisible = usePageVisible();
  const hasVisibilityMountedRef = useRef(false);
  const wasVisibleRef = useRef(false);
  const lastRefreshAtRef = useRef(0);

  const [monthCursor, setMonthCursor] = useState(() => monthStart(new Date()));
  const [analyticsPage, setAnalyticsPage] = useState(1);
  const [analyticsDraftFilters, setAnalyticsDraftFilters] =
    useState<AnalyticsFilterFormState>(INITIAL_ANALYTICS_FILTERS);
  const [analyticsAppliedFilters, setAnalyticsAppliedFilters] =
    useState<AnalyticsFilterFormState>(INITIAL_ANALYTICS_FILTERS);

  const memberType = member?.memberType;
  const isAgent = memberType === "AGENT";
  const isAdminArea = memberType === "ADMIN" || memberType === "ADMIN_OPERATOR";

  const analyticsSearch = useMemo<AnalyticsEventSearchInput | undefined>(() => {
    if (!isAdminArea) return undefined;
    const eventName = analyticsAppliedFilters.eventName.trim();
    const memberId = analyticsAppliedFilters.memberId.trim();
    const source = analyticsAppliedFilters.source.trim();
    const search: AnalyticsEventSearchInput = {};
    if (eventName) search.eventName = eventName;
    if (memberId) search.memberId = memberId;
    if (analyticsAppliedFilters.memberType) search.memberType = analyticsAppliedFilters.memberType;
    if (source) search.source = source;
    if (analyticsAppliedFilters.fromDate) search.fromDate = analyticsAppliedFilters.fromDate;
    if (analyticsAppliedFilters.toDate) search.toDate = analyticsAppliedFilters.toDate;
    return Object.keys(search).length > 0 ? search : undefined;
  }, [analyticsAppliedFilters, isAdminArea]);

  const {
    data: authData,
    loading: authLoading,
    error: authError,
    refetch: refetchAuth,
  } = useQuery<CheckAuthQueryData>(CHECK_AUTH_QUERY, {
    fetchPolicy: "cache-and-network",
    nextFetchPolicy: "cache-and-network",
  });

  const {
    data: dashboardStatsData,
    loading: dashboardStatsLoading,
    error: dashboardStatsError,
    refetch: refetchDashboardStats,
  } = useQuery<GetDashboardStatsQueryData>(GET_DASHBOARD_STATS_QUERY, {
    skip: !isAdminArea,
    fetchPolicy: "cache-and-network",
    nextFetchPolicy: "cache-and-network",
  });

  const {
    data: adminHotelsData,
    loading: adminHotelsLoading,
    error: adminHotelsError,
    refetch: refetchAdminHotels,
  } = useQuery<GetHotelsQueryData, GetHotelsQueryVars>(GET_HOTELS_QUERY, {
    skip: !isAdminArea,
    variables: { input: ADMIN_HOTELS_INPUT },
    fetchPolicy: "cache-and-network",
    nextFetchPolicy: "cache-and-network",
  });

  const {
    data: allBookingsData,
    loading: allBookingsLoading,
    error: allBookingsError,
    refetch: refetchAllBookings,
  } = useQuery<GetAllBookingsAdminQueryData, GetAllBookingsAdminQueryVars>(
    GET_ALL_BOOKINGS_ADMIN_QUERY,
    {
      skip: !isAdminArea,
      variables: { input: ADMIN_BOOKINGS_INPUT },
      fetchPolicy: "cache-and-network",
      nextFetchPolicy: "cache-and-network",
    },
  );

  const {
    data: allReviewsData,
    loading: allReviewsLoading,
    error: allReviewsError,
    refetch: refetchAllReviews,
  } = useQuery<GetAllReviewsAdminQueryData, GetAllReviewsAdminQueryVars>(
    GET_ALL_REVIEWS_ADMIN_QUERY,
    {
      skip: !isAdminArea,
      variables: {
        input: ADMIN_REVIEWS_INPUT,
        statusFilter: "APPROVED" satisfies ReviewStatus,
      },
      fetchPolicy: "cache-and-network",
      nextFetchPolicy: "cache-and-network",
    },
  );

  const {
    data: analyticsEventsData,
    loading: analyticsEventsLoading,
    error: analyticsEventsError,
    refetch: refetchAnalyticsEvents,
  } = useQuery<GetAnalyticsEventsAdminQueryData, GetAnalyticsEventsAdminQueryVars>(
    GET_ANALYTICS_EVENTS_ADMIN_QUERY,
    {
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
      fetchPolicy: "cache-and-network",
      nextFetchPolicy: "cache-and-network",
    },
  );

  const {
    data: agentHotelsData,
    loading: agentHotelsLoading,
    error: agentHotelsError,
  } = useQuery<GetAgentHotelsQueryData, GetAgentHotelsQueryVars>(
    GET_AGENT_HOTELS_QUERY,
    {
      skip: !isAgent,
      variables: { input: AGENT_HOTELS_INPUT },
      fetchPolicy: "cache-and-network",
      nextFetchPolicy: "cache-and-network",
    },
  );

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
    if (!becameVisible) return;

    const nowMs = Date.now();
    if (nowMs - lastRefreshAtRef.current < DASHBOARD_REFRESH_COOLDOWN_MS) return;
    lastRefreshAtRef.current = nowMs;

    void refetchAuth();
    if (isAdminArea) {
      void refetchDashboardStats();
      void refetchAdminHotels();
      void refetchAllBookings();
      void refetchAllReviews();
      void refetchAnalyticsEvents();
    }
  }, [
    isAdminArea,
    isPageVisible,
    refetchAdminHotels,
    refetchAllBookings,
    refetchAllReviews,
    refetchAnalyticsEvents,
    refetchAuth,
    refetchDashboardStats,
  ]);

  const hotels = useMemo(() => adminHotelsData?.getHotels.list ?? [], [adminHotelsData]);
  const hotelsMap = useMemo(() => {
    const map = new Map<string, HotelListItem>();
    hotels.forEach((hotel) => {
      map.set(hotel._id, hotel);
    });
    return map;
  }, [hotels]);

  const stats = dashboardStatsData?.getDashboardStats;
  const recentBookings = useMemo(
    () => allBookingsData?.getAllBookingsAdmin.list ?? [],
    [allBookingsData],
  );
  const recentReviews = useMemo(
    () => allReviewsData?.getAllReviewsAdmin.list ?? [],
    [allReviewsData],
  );
  const analyticsEvents = analyticsEventsData?.getAnalyticsEventsAdmin.list ?? [];
  const analyticsTotal = analyticsEventsData?.getAnalyticsEventsAdmin.metaCounter.total ?? 0;
  const analyticsTotalPages = Math.max(1, Math.ceil(analyticsTotal / ANALYTICS_LIST_LIMIT));

  const bookingCounts = useMemo(() => {
    const counts: Record<BookingStatus, number> = {
      PENDING: 0,
      CONFIRMED: 0,
      CHECKED_IN: 0,
      CHECKED_OUT: 0,
      CANCELLED: 0,
      NO_SHOW: 0,
    };
    recentBookings.forEach((booking) => {
      counts[booking.bookingStatus] += 1;
    });
    return counts;
  }, [recentBookings]);

  const completedBase = Math.max(1, bookingCounts.CHECKED_IN + bookingCounts.CHECKED_OUT + bookingCounts.CONFIRMED);
  const checkInPercent = (bookingCounts.CHECKED_IN / completedBase) * 100;
  const checkOutPercent = (bookingCounts.CHECKED_OUT / completedBase) * 100;

  const bookingDensityByDay = useMemo(() => {
    const map = new Map<string, number>();
    recentBookings.forEach((booking) => {
      const key = toDayKey(booking.checkInDate);
      map.set(key, (map.get(key) ?? 0) + 1);
    });
    return map;
  }, [recentBookings]);

  const calendarDays = useMemo(() => buildCalendarDays(monthCursor), [monthCursor]);
  const monthLabel = useMemo(() => formatMonthLabel(monthCursor), [monthCursor]);
  const activeMonth = monthCursor.getUTCMonth();
  const todayKey = useMemo(() => toDayKey(new Date().toISOString()), []);

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
    if (nextPage < 1 || nextPage > analyticsTotalPages) return;
    setAnalyticsPage(nextPage);
  };

  if (!isAdminArea) {
    const agentHotels = agentHotelsData?.getAgentHotels.list ?? [];
    return (
      <main className="mx-auto w-full max-w-5xl space-y-5">
        <section className="rounded-3xl border border-sky-200 bg-gradient-to-br from-sky-50 to-white p-6">
          <p className="text-xs font-semibold uppercase tracking-[0.15em] text-sky-700">Agent Workspace</p>
          <h1 className="mt-2 text-3xl font-semibold text-slate-900">
            Welcome, {member?.memberNick ?? "Agent"}
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            Use chats and manage bookings/hotels from your assigned inventory.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link
              href="/chats"
              className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-700"
            >
              Open chats
            </Link>
            <Link
              href="/bookings/manage"
              className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-500"
            >
              Manage bookings
            </Link>
          </div>
        </section>

        {agentHotelsError ? <ErrorNotice message={getErrorMessage(agentHotelsError)} /> : null}
        {agentHotelsLoading && agentHotels.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-600">
            Loading your hotels...
          </div>
        ) : null}
        {!agentHotelsLoading && agentHotels.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-600">
            No managed hotels found for your account.
          </div>
        ) : null}
        {agentHotels.length > 0 ? (
          <section className="rounded-2xl border border-slate-200 bg-white p-5">
            <h2 className="text-lg font-semibold text-slate-900">Assigned Hotels</h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {agentHotels.map((hotel) => (
                <Link
                  key={hotel._id}
                  href={`/hotels/${hotel._id}`}
                  className="rounded-xl border border-slate-200 p-4 transition hover:border-slate-300 hover:bg-slate-50"
                >
                  <p className="font-semibold text-slate-900">{hotel.hotelTitle}</p>
                  <p className="mt-1 text-sm text-slate-500">
                    {hotel.hotelLocation} · {hotel.hotelType}
                  </p>
                  <p className="mt-2 text-xs text-slate-500">
                    Rating {hotel.hotelRating.toFixed(1)} · Likes {formatNumber(hotel.hotelLikes)}
                  </p>
                </Link>
              ))}
            </div>
          </section>
        ) : null}
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-6xl space-y-5">
      <section className="rounded-3xl border border-slate-200 bg-gradient-to-br from-slate-100 via-white to-cyan-50 p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Admin Control Center</p>
            <h1 className="mt-2 text-3xl font-semibold text-slate-900">Dashboard</h1>
            <p className="mt-2 max-w-2xl text-sm text-slate-600">
              Real-time overview of bookings, reviews, inventory health, and onboarding event activity.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <span className="rounded-full bg-slate-900 px-3 py-1 text-xs font-semibold text-white">
                {member?.memberType ?? "ADMIN"}
              </span>
              {authData?.checkAuth ? (
                <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">
                  Token verified
                </span>
              ) : null}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => {
                void refetchDashboardStats();
                void refetchAllBookings();
                void refetchAllReviews();
                void refetchAnalyticsEvents();
              }}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-500"
            >
              <RefreshCcw size={14} />
              Refresh
            </button>
            <Link
              href="/bookings/manage"
              className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-700"
            >
              Manage bookings
              <ArrowUpRight size={14} />
            </Link>
          </div>
        </div>
        {authLoading ? (
          <p className="mt-3 text-xs text-slate-500">Refreshing auth status...</p>
        ) : null}
        {authError ? <ErrorNotice className="mt-3" message={getErrorMessage(authError)} /> : null}
      </section>

      {dashboardStatsError ? <ErrorNotice message={getErrorMessage(dashboardStatsError)} /> : null}
      {dashboardStatsLoading && !stats ? (
        <section className="rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-600">
          Loading dashboard metrics...
        </section>
      ) : null}

      {stats ? (
        <>
          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <KpiCard
              title="Total Members"
              value={formatNumber(stats.totalMembers)}
              deltaText={`${formatNumber(stats.newBookingsToday)} new bookings today`}
              tone="sky"
              icon={<UsersRound size={20} />}
            />
            <KpiCard
              title="Total Hotels"
              value={formatNumber(stats.totalHotels)}
              deltaText={`${formatNumber(stats.pendingHotels)} pending verification`}
              tone="emerald"
              icon={<Building2 size={20} />}
            />
            <KpiCard
              title="Total Bookings"
              value={formatNumber(stats.totalBookings)}
              deltaText={`${formatNumber(stats.pendingBookings)} still pending`}
              tone="amber"
              icon={<BookCheck size={20} />}
            />
            <KpiCard
              title="Total Revenue"
              value={`₩ ${formatNumber(stats.totalRevenue)}`}
              deltaText={`₩ ${formatNumber(stats.todayRevenue)} today`}
              tone="rose"
              icon={<Wallet size={20} />}
            />
          </section>

          <section className="grid gap-4 xl:grid-cols-[1.45fr_1fr]">
            <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.15em] text-slate-500">Booking Calendar</p>
                  <h2 className="mt-1 text-2xl font-semibold text-slate-900">{monthLabel}</h2>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setMonthCursor((prev) => addMonths(prev, -1))}
                    className="rounded-lg border border-slate-300 p-2 text-slate-700 transition hover:border-slate-500"
                    aria-label="Previous month"
                  >
                    <ChevronLeft size={15} />
                  </button>
                  <button
                    type="button"
                    onClick={() => setMonthCursor((prev) => addMonths(prev, 1))}
                    className="rounded-lg border border-slate-300 p-2 text-slate-700 transition hover:border-slate-500"
                    aria-label="Next month"
                  >
                    <ChevronRight size={15} />
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-7 gap-1 rounded-2xl border border-slate-200 bg-slate-50 p-3">
                {WEEK_LABELS.map((label) => (
                  <div key={label} className="pb-1 text-center text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                    {label}
                  </div>
                ))}
                {calendarDays.map((day) => {
                  const key = toDayKey(day.toISOString());
                  const inCurrentMonth = day.getUTCMonth() === activeMonth;
                  const dayCount = bookingDensityByDay.get(key) ?? 0;
                  const isToday = key === todayKey;
                  return (
                    <div
                      key={`${key}-${inCurrentMonth ? "current" : "edge"}`}
                      className={`relative min-h-[64px] rounded-xl border px-2 py-1.5 transition ${
                        inCurrentMonth
                          ? "border-slate-200 bg-white"
                          : "border-slate-100 bg-slate-50 text-slate-300"
                      } ${isToday ? "ring-2 ring-sky-300" : ""}`}
                    >
                      <p className={`text-sm font-semibold ${inCurrentMonth ? "text-slate-800" : "text-slate-300"}`}>
                        {day.getUTCDate()}
                      </p>
                      {dayCount > 0 ? (
                        <span className="absolute bottom-1.5 left-2 inline-flex items-center rounded-full bg-sky-100 px-1.5 py-0.5 text-[10px] font-semibold text-sky-700">
                          {dayCount} bk
                        </span>
                      ) : null}
                    </div>
                  );
                })}
              </div>

              <div className="mt-5">
                <div className="mb-2 flex items-center justify-between">
                  <h3 className="text-base font-semibold text-slate-900">Newest Bookings</h3>
                  <Link href="/bookings/manage" className="text-sm font-semibold text-sky-700">
                    Open all
                  </Link>
                </div>
                {allBookingsError ? <ErrorNotice message={getErrorMessage(allBookingsError)} /> : null}
                {allBookingsLoading && recentBookings.length === 0 ? (
                  <p className="text-sm text-slate-600">Loading recent bookings...</p>
                ) : null}
                {recentBookings.length > 0 ? (
                  <div className="grid gap-2 sm:grid-cols-2">
                    {recentBookings.slice(0, 6).map((booking) => {
                      const hotel = hotelsMap.get(booking.hotelId);
                      return (
                        <Link
                          key={booking._id}
                          href={`/bookings/${booking._id}`}
                          className="rounded-xl border border-slate-200 p-3 transition hover:border-slate-300 hover:bg-slate-50"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <p className="text-sm font-semibold text-slate-900">{hotel?.hotelTitle ?? "Unknown Hotel"}</p>
                            <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${BOOKING_STATUS_COLOR[booking.bookingStatus]}`}>
                              {BOOKING_STATUS_LABEL[booking.bookingStatus]}
                            </span>
                          </div>
                          <p className="mt-1 text-xs text-slate-500">#{booking.bookingCode}</p>
                          <p className="mt-1 text-xs text-slate-600">
                            {formatDateShort(booking.checkInDate)} - {formatDateShort(booking.checkOutDate)}
                          </p>
                          <p className="mt-1 text-xs font-medium text-slate-700">₩ {formatNumber(booking.totalPrice)}</p>
                        </Link>
                      );
                    })}
                  </div>
                ) : null}
              </div>
            </section>

            <div className="space-y-4">
              <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="text-base font-semibold text-slate-900">Reservation Split</h3>
                  <span className="text-xs text-slate-500">Recent {recentBookings.length} records</span>
                </div>
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
                  <RingGauge label="Check in" value={checkInPercent} color="#2563eb" />
                  <RingGauge label="Check out" value={checkOutPercent} color="#f59e0b" />
                </div>
                <div className="mt-4 space-y-2">
                  {(["PENDING", "CONFIRMED", "CHECKED_IN", "CHECKED_OUT", "CANCELLED"] as const).map((status) => (
                    <div key={status} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2">
                      <div className="flex items-center gap-2">
                        <span className={`h-2 w-2 rounded-full ${status === "CHECKED_OUT" ? "bg-indigo-500" : status === "CHECKED_IN" ? "bg-emerald-500" : status === "CONFIRMED" ? "bg-sky-500" : status === "PENDING" ? "bg-amber-500" : "bg-rose-500"}`} />
                        <p className="text-xs font-medium text-slate-600">{BOOKING_STATUS_LABEL[status]}</p>
                      </div>
                      <p className="text-sm font-semibold text-slate-900">{formatNumber(bookingCounts[status])}</p>
                    </div>
                  ))}
                </div>
              </section>

              <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="text-base font-semibold text-slate-900">Latest Customer Reviews</h3>
                  {allReviewsData?.getAllReviewsAdmin.ratingsSummary ? (
                    <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-700">
                      Avg {allReviewsData.getAllReviewsAdmin.ratingsSummary.overallRating.toFixed(1)}
                    </span>
                  ) : null}
                </div>
                {allReviewsError ? <ErrorNotice message={getErrorMessage(allReviewsError)} /> : null}
                {allReviewsLoading && recentReviews.length === 0 ? (
                  <p className="text-sm text-slate-600">Loading latest reviews...</p>
                ) : null}
                {recentReviews.length > 0 ? (
                  <div className="space-y-2">
                    {recentReviews.slice(0, 4).map((review) => {
                      const hotel = hotelsMap.get(review.hotelId);
                      return (
                        <article key={review._id} className="rounded-xl border border-slate-200 p-3">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <p className="text-sm font-semibold text-slate-900">
                                {review.reviewerNick ?? "Verified Guest"}
                              </p>
                              <p className="text-xs text-slate-500">
                                {hotel?.hotelTitle ?? "Unknown Hotel"} · {formatDateShort(review.createdAt)}
                              </p>
                            </div>
                            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700">
                              {review.overallRating.toFixed(1)}★
                            </span>
                          </div>
                          <p className="mt-2 line-clamp-2 text-sm text-slate-700">{review.reviewText}</p>
                        </article>
                      );
                    })}
                  </div>
                ) : null}
              </section>
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.15em] text-slate-500">Onboarding Analytics</p>
                <h2 className="mt-1 text-xl font-semibold text-slate-900">Event Stream</h2>
                <p className="mt-1 text-sm text-slate-600">Filter member onboarding and behavior events for support and growth checks.</p>
              </div>
              <span className="rounded-full bg-slate-900 px-3 py-1 text-xs font-semibold text-white">
                Total {formatNumber(analyticsTotal)}
              </span>
            </div>

            <div className="mt-4 grid gap-2 md:grid-cols-2 xl:grid-cols-4">
              <input
                value={analyticsDraftFilters.eventName}
                onChange={(event) => setAnalyticsDraftFilters((prev) => ({ ...prev, eventName: event.target.value }))}
                placeholder="Event name"
                className="rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-slate-500"
              />
              <input
                value={analyticsDraftFilters.memberId}
                onChange={(event) => setAnalyticsDraftFilters((prev) => ({ ...prev, memberId: event.target.value }))}
                placeholder="Member ID"
                className="rounded-xl border border-slate-300 px-3 py-2 font-mono text-sm text-slate-900 outline-none transition focus:border-slate-500"
              />
              <input
                value={analyticsDraftFilters.source}
                onChange={(event) => setAnalyticsDraftFilters((prev) => ({ ...prev, source: event.target.value }))}
                placeholder="Source"
                className="rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-slate-500"
              />
              <select
                value={analyticsDraftFilters.memberType}
                onChange={(event) => setAnalyticsDraftFilters((prev) => ({ ...prev, memberType: event.target.value as AnalyticsFilterFormState["memberType"] }))}
                className="rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-slate-500"
              >
                <option value="">All member types</option>
                <option value="USER">USER</option>
                <option value="AGENT">AGENT</option>
                <option value="ADMIN">ADMIN</option>
                <option value="ADMIN_OPERATOR">ADMIN_OPERATOR</option>
              </select>
              <input
                type="date"
                value={analyticsDraftFilters.fromDate}
                onChange={(event) => setAnalyticsDraftFilters((prev) => ({ ...prev, fromDate: event.target.value }))}
                className="rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-slate-500"
              />
              <input
                type="date"
                value={analyticsDraftFilters.toDate}
                onChange={(event) => setAnalyticsDraftFilters((prev) => ({ ...prev, toDate: event.target.value }))}
                className="rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-slate-500"
              />
              <button
                type="button"
                onClick={applyAnalyticsFilters}
                className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-700"
              >
                Apply filters
              </button>
              <button
                type="button"
                onClick={resetAnalyticsFilters}
                className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-500"
              >
                Reset
              </button>
            </div>

            <div className="mt-4 space-y-2">
              {analyticsEventsError ? <ErrorNotice message={getErrorMessage(analyticsEventsError)} /> : null}
              {analyticsEventsLoading && analyticsEvents.length === 0 ? (
                <p className="text-sm text-slate-600">Loading analytics events...</p>
              ) : null}
              {!analyticsEventsLoading && analyticsEvents.length === 0 ? (
                <p className="text-sm text-slate-600">No analytics events found for the selected filters.</p>
              ) : null}
              {analyticsEvents.map((eventItem) => (
                <article key={eventItem._id} className="rounded-xl border border-slate-200 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-700">
                        {eventItem.eventName}
                      </span>
                      <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${memberTypeTone(eventItem.memberType)}`}>
                        {eventItem.memberType}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500">{formatDateTime(eventItem.createdAt)}</p>
                  </div>
                  <div className="mt-2 grid gap-2 text-xs text-slate-600 md:grid-cols-3">
                    <p className="truncate font-mono text-[11px] text-slate-500">{eventItem.memberId}</p>
                    <p>{eventItem.eventPath ?? "-"}</p>
                    <p>{eventItem.source ?? "-"}</p>
                  </div>
                  {eventItem.payload ? (
                    <p className="mt-2 line-clamp-2 text-xs text-slate-600">
                      {eventItem.payload.length > 180
                        ? `${eventItem.payload.slice(0, 180)}...`
                        : eventItem.payload}
                    </p>
                  ) : null}
                </article>
              ))}
            </div>

            {analyticsTotal > 0 ? (
              <div className="mt-4 flex items-center justify-between">
                <p className="text-xs text-slate-600">
                  Page {analyticsPage} / {analyticsTotalPages}
                </p>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={analyticsPage <= 1}
                    onClick={() => handleAnalyticsPageChange(analyticsPage - 1)}
                    className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:border-slate-500 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Prev
                  </button>
                  <button
                    type="button"
                    disabled={analyticsPage >= analyticsTotalPages}
                    onClick={() => handleAnalyticsPageChange(analyticsPage + 1)}
                    className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:border-slate-500 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Next
                  </button>
                </div>
              </div>
            ) : null}
          </section>

          <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <article className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-slate-700">Pending Hotels</p>
                <Clock3 size={16} className="text-slate-400" />
              </div>
              <p className="mt-2 text-2xl font-semibold text-slate-900">{formatNumber(stats.pendingHotels)}</p>
              <p className="mt-1 text-xs text-slate-500">Need admin verification</p>
            </article>
            <article className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-slate-700">Pending Bookings</p>
                <MessageSquareText size={16} className="text-slate-400" />
              </div>
              <p className="mt-2 text-2xl font-semibold text-slate-900">{formatNumber(stats.pendingBookings)}</p>
              <p className="mt-1 text-xs text-slate-500">Awaiting payment/action</p>
            </article>
            <article className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-slate-700">New Bookings Today</p>
                <ArrowUpRight size={16} className="text-emerald-500" />
              </div>
              <p className="mt-2 text-2xl font-semibold text-slate-900">{formatNumber(stats.newBookingsToday)}</p>
              <p className="mt-1 text-xs text-slate-500">Daily intake trend</p>
            </article>
            <article className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-slate-700">Today Revenue</p>
                <ArrowDownRight size={16} className="text-sky-500" />
              </div>
              <p className="mt-2 text-2xl font-semibold text-slate-900">₩ {formatNumber(stats.todayRevenue)}</p>
              <p className="mt-1 text-xs text-slate-500">Collected in last 24h</p>
            </article>
          </section>
        </>
      ) : null}

      {adminHotelsError ? <ErrorNotice message={getErrorMessage(adminHotelsError)} /> : null}
      {adminHotelsLoading ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-600">
          <span className="inline-flex items-center gap-2">
            <Loader2 size={14} className="animate-spin text-slate-500" />
            Loading hotel context...
          </span>
        </div>
      ) : null}
      {hotels.length > 0 ? (
        <section className="rounded-2xl border border-slate-200 bg-white p-4">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-base font-semibold text-slate-900">Hotel Inventory Snapshot</h3>
            <Link href="/hotels" className="text-sm font-semibold text-sky-700">
              Browse hotels
            </Link>
          </div>
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
            {hotels.slice(0, 8).map((hotel) => (
              <Link
                key={hotel._id}
                href={`/hotels/${hotel._id}`}
                className="rounded-xl border border-slate-200 p-3 transition hover:border-slate-300 hover:bg-slate-50"
              >
                <p className="truncate text-sm font-semibold text-slate-900">{hotel.hotelTitle}</p>
                <p className="mt-1 text-xs text-slate-500">
                  {hotel.hotelLocation} · {hotel.hotelType}
                </p>
                <div className="mt-2 flex items-center gap-2">
                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-700">
                    <CheckCircle2 size={10} />
                    {hotel.hotelRating.toFixed(1)}
                  </span>
                  <span className="text-[11px] text-slate-500">Likes {formatNumber(hotel.hotelLikes)}</span>
                </div>
              </Link>
            ))}
          </div>
        </section>
      ) : null}
    </main>
  );
};

DashboardPage.auth = {
  roles: ["AGENT", "ADMIN", "ADMIN_OPERATOR"],
};

export default DashboardPage;
