import { useMutation, useQuery } from "@apollo/client/react";
import Link from "next/link";
import { useRouter } from "next/router";
import { useCallback, useEffect, useRef, useState } from "react";
import type { PropsWithChildren } from "react";
import { ChatDrawer } from "@/components/chat/chat-drawer";
import { PriceLockFab } from "@/components/layout/price-lock-fab";
import { useToast } from "@/components/ui/toast-provider";
import { GET_MY_UNREAD_CHAT_COUNT_QUERY } from "@/graphql/chat.gql";
import { GET_MEMBER_QUERY } from "@/graphql/member.gql";
import {
  GET_MY_NOTIFICATIONS_QUERY,
  GET_UNREAD_COUNT_QUERY,
  MARK_ALL_AS_READ_MUTATION,
  MARK_AS_READ_MUTATION,
} from "@/graphql/notification.gql";
import {
  clearAuthSession,
  getAccessToken,
  getSessionMember,
} from "@/lib/auth/session";
import { resolveMediaUrl } from "@/lib/utils/media-url";
import { usePageVisible } from "@/lib/hooks/use-page-visible";
import { createNotificationSocket } from "@/lib/socket/notification";
import type { SessionMember } from "@/types/auth";
import type { GetMyUnreadChatCountQueryData } from "@/types/chat";
import {
  Bell,
  CheckCheck,
  Crown,
  Heart,
  LogOut,
  MessageSquare,
  Settings,
  Star,
  User,
} from "lucide-react";

const UNREAD_POLL_INTERVAL_MS = 120000;
const NOTIFICATION_POLL_INTERVAL_MS = 60000;

// ─── Role-aware navigation ────────────────────────────────────────────────────

const NAV_LINKS = {
  guest: [{ href: "/hotels", label: "Hotels" }],
  user: [
    { href: "/hotels", label: "Hotels" },
    { href: "/bookings", label: "My bookings" },
    { href: "/bookings/new", label: "New booking" },
  ],
  staff: [
    { href: "/hotels", label: "Hotels" },
    { href: "/bookings/manage", label: "Manage" },
    { href: "/dashboard", label: "Dashboard" },
  ],
  admin: [
    { href: "/hotels", label: "Hotels" },
    { href: "/bookings/manage", label: "Manage" },
    { href: "/dashboard", label: "Dashboard" },
    { href: "/admin/subscriptions", label: "Subscriptions" },
  ],
} as const;

function getNavLinks(member: SessionMember | null) {
  if (!member) return NAV_LINKS.guest;
  if (member.memberType === "USER") return NAV_LINKS.user;
  if (member.memberType === "ADMIN" || member.memberType === "ADMIN_OPERATOR") return NAV_LINKS.admin;
  return NAV_LINKS.staff;
}

const isActive = (pathname: string, href: string): boolean => {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
};

// ─── Avatar colors by role ────────────────────────────────────────────────────

const ROLE_COLOR: Record<string, string> = {
  USER: "bg-sky-500",
  AGENT: "bg-violet-500",
  ADMIN: "bg-rose-500",
  ADMIN_OPERATOR: "bg-rose-500",
};

function memberAvatar(member: SessionMember) {
  const bg = ROLE_COLOR[member.memberType] ?? "bg-slate-500";
  const initials = member.memberNick.slice(0, 2).toUpperCase();
  if (member.memberImage) {
    return (
      <div className={`h-full w-full overflow-hidden rounded-full ${bg}`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={resolveMediaUrl(member.memberImage)}
          alt={initials}
          className="h-full w-full object-cover"
        />
      </div>
    );
  }
  return <span>{initials}</span>;
}

// ─── User avatar dropdown ─────────────────────────────────────────────────────

function UserAvatarMenu({
  member,
  onLogout,
}: {
  member: SessionMember;
  onLogout: () => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node))
        setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const bg = ROLE_COLOR[member.memberType] ?? "bg-slate-500";
  const roleLabel = member.memberType.replace("_", " ").toLowerCase();

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`flex h-8 w-8 items-center justify-center rounded-full ${bg} text-[11px] font-bold text-white transition hover:opacity-90 hover:ring-2 hover:ring-sky-300 hover:ring-offset-1`}
        aria-label="Account menu"
        aria-expanded={open}
      >
        {memberAvatar(member)}
      </button>

      {open && (
        <div className="absolute right-0 top-10 z-50 w-52 overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-2xl">
          <div className="border-b border-slate-50 px-4 pb-3 pt-3">
            <p className="truncate text-sm font-semibold text-slate-900">
              {member.memberNick}
            </p>
            <p className="text-[11px] capitalize text-slate-400">{roleLabel}</p>
          </div>
          <div className="py-1">
            <Link
              href="/profile"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-slate-700 transition hover:bg-slate-50"
            >
              <User size={14} className="text-slate-400" />
              Profile
            </Link>
            {member.memberType === "USER" && (
              <>
                <Link
                  href="/profile?tab=subscription"
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-slate-700 transition hover:bg-slate-50"
                >
                  <Crown size={14} className="text-slate-400" />
                  Subscription
                </Link>
                <Link
                  href="/profile?tab=reviews"
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-slate-700 transition hover:bg-slate-50"
                >
                  <Star size={14} className="text-slate-400" />
                  My Reviews
                </Link>
                <Link
                  href="/profile?tab=likes"
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-slate-700 transition hover:bg-slate-50"
                >
                  <Heart size={14} className="text-slate-400" />
                  Saved Hotels
                </Link>
              </>
            )}
            <Link
              href="/settings/preferences"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-slate-700 transition hover:bg-slate-50"
            >
              <Settings size={14} className="text-slate-400" />
              Settings
            </Link>
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                onLogout();
              }}
              className="flex w-full items-center gap-2.5 px-4 py-2.5 text-sm text-rose-500 transition hover:bg-rose-50"
            >
              <LogOut size={14} />
              Sign out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Notification type icons ──────────────────────────────────────────────────

const NOTIF_TYPE_COLOR: Record<string, string> = {
  BOOKING: "bg-sky-50 text-sky-500",
  REVIEW: "bg-amber-50 text-amber-500",
  CHAT: "bg-violet-50 text-violet-500",
  SYSTEM: "bg-slate-50 text-slate-500",
  PRICE_DROP: "bg-emerald-50 text-emerald-500",
  RECOMMENDATION: "bg-rose-50 text-rose-500",
};

function notifDot(type: string) {
  const cls = NOTIF_TYPE_COLOR[type] ?? "bg-slate-50 text-slate-400";
  return (
    <span
      className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-xs font-bold ${cls}`}
    >
      {type.charAt(0)}
    </span>
  );
}

function timeAgoShort(dateStr: string): string {
  const ms = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(ms / 60000);
  if (m < 1) return "now";
  if (m < 60) return `${m}m`;
  const h = Math.floor(ms / 3600000);
  if (h < 24) return `${h}h`;
  const d = Math.floor(ms / 86400000);
  if (d < 7) return `${d}d`;
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

interface NotifItem {
  _id: string;
  type: string;
  title: string;
  message: string;
  link?: string | null;
  read: boolean;
  createdAt: string;
}

// ─── Notification bell + drawer ───────────────────────────────────────────────

function NotificationBellDrawer({
  unreadCount,
  onCountChange,
}: {
  unreadCount: number;
  onCountChange: () => void;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const { data, loading, refetch } = useQuery<{
    getMyNotifications: NotifItem[];
  }>(GET_MY_NOTIFICATIONS_QUERY, {
    skip: !open,
    fetchPolicy: "network-only",
  });

  const [markAsRead] = useMutation(MARK_AS_READ_MUTATION);
  const [markAllAsRead] = useMutation(MARK_ALL_AS_READ_MUTATION);

  const notifications = data?.getMyNotifications ?? [];
  // Show only latest 6 in the quick drawer
  const visible = notifications.slice(0, 6);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node))
        setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  // Close on route change
  useEffect(() => {
    setOpen(false);
  }, [router.asPath]);

  const handleToggle = () => {
    setOpen((o) => !o);
  };

  const handleMarkAllRead = async () => {
    try {
      await markAllAsRead();
      onCountChange();
      void refetch();
    } catch {
      // silent
    }
  };

  const handleClickNotif = async (item: NotifItem) => {
    if (!item.read) {
      try {
        await markAsRead({ variables: { notificationId: item._id } });
        onCountChange();
        void refetch();
      } catch {
        // silent
      }
    }
    setOpen(false);
    if (item.link) {
      void router.push(item.link);
    }
  };

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={handleToggle}
        className="relative flex h-8 w-8 items-center justify-center rounded-full text-slate-500 transition hover:bg-slate-100"
        aria-label="Notifications"
        aria-expanded={open}
      >
        <Bell size={17} />
        {unreadCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-rose-500 px-0.5 text-[9px] font-bold text-white">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-10 z-50 w-80 overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-2xl sm:w-96">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
            <h3 className="text-sm font-semibold text-slate-900">
              Notifications
            </h3>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={() => {
                  void handleMarkAllRead();
                }}
                className="flex items-center gap-1 text-xs font-medium text-sky-500 transition hover:text-sky-600"
              >
                <CheckCheck size={13} />
                Mark all read
              </button>
            )}
          </div>

          {/* List */}
          <div className="max-h-[340px] overflow-y-auto">
            {loading && visible.length === 0 ? (
              <div className="space-y-3 p-4">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="flex gap-3">
                    <div className="h-8 w-8 animate-pulse rounded-full bg-slate-100" />
                    <div className="flex-1 space-y-1.5">
                      <div className="h-3 w-3/4 animate-pulse rounded bg-slate-100" />
                      <div className="h-2.5 w-1/2 animate-pulse rounded bg-slate-100" />
                    </div>
                  </div>
                ))}
              </div>
            ) : visible.length === 0 ? (
              <div className="px-4 py-10 text-center">
                <Bell size={28} className="mx-auto mb-2 text-slate-200" />
                <p className="text-sm text-slate-400">No notifications yet</p>
              </div>
            ) : (
              visible.map((item) => (
                <button
                  key={item._id}
                  type="button"
                  onClick={() => {
                    void handleClickNotif(item);
                  }}
                  className={`group flex w-full items-start gap-3 px-4 py-3 text-left transition hover:bg-slate-50 ${
                    !item.read ? "bg-sky-50/40" : ""
                  }`}
                >
                  {notifDot(item.type)}
                  <div className="min-w-0 flex-1">
                    <p
                      className={`truncate text-sm ${
                        item.read
                          ? "font-medium text-slate-600"
                          : "font-semibold text-slate-900"
                      }`}
                    >
                      {item.title}
                    </p>
                    <p className="mt-0.5 line-clamp-2 text-xs text-slate-400">
                      {item.message}
                    </p>
                  </div>
                  <div className="flex flex-shrink-0 flex-col items-end gap-1">
                    <span className="text-[10px] text-slate-300">
                      {timeAgoShort(item.createdAt)}
                    </span>
                    {!item.read && (
                      <span className="h-2 w-2 rounded-full bg-sky-500" />
                    )}
                  </div>
                </button>
              ))
            )}
          </div>

          {/* Footer */}
          {visible.length > 0 && (
            <div className="border-t border-slate-100 px-4 py-2.5 text-center">
              <Link
                href="/notifications"
                className="text-xs font-medium text-sky-500 transition hover:text-sky-600"
                onClick={() => setOpen(false)}
              >
                View all notifications
              </Link>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── SiteFrame ────────────────────────────────────────────────────────────────

export function SiteFrame({ children }: PropsWithChildren) {
  const router = useRouter();
  const toast = useToast();
  const isHomeRoute = router.pathname === "/";
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isChatPanelOpen, setIsChatPanelOpen] = useState(false);

  // Refresh member on every route change (captures login/logout navigation)
  const [member, setMember] = useState<SessionMember | null>(null);
  useEffect(() => {
    setMember(getSessionMember());
  }, [router.asPath]);

  // Subscribe to Apollo cache for live memberImage updates when profile is saved.
  // fetchPolicy:"cache-only" means no extra network request — it just reads
  // whatever the profile page already fetched and updates when the mutation fires.
  const { data: memberCacheData } = useQuery<{ getMember: { memberImage?: string | null } }>(
    GET_MEMBER_QUERY,
    { skip: !member, fetchPolicy: "cache-only" },
  );
  // Merge live image into member so both desktop and mobile avatars auto-update
  const memberWithLiveImage = member
    ? { ...member, memberImage: memberCacheData?.getMember.memberImage ?? member.memberImage }
    : null;

  const isPageVisible = usePageVisible();
  const canTrackUnread = Boolean(member);
  const isChatRoute =
    router.pathname === "/chats" || router.pathname === "/chats/[chatId]";
  const canPollUnread = canTrackUnread && isPageVisible && !isChatRoute;
  const previousUnreadRef = useRef<number | null>(null);
  const hasPolledOnVisibleRef = useRef(false);

  const navLinks = getNavLinks(member);

  const handleLogout = () => {
    clearAuthSession();
    void router.push("/auth/login");
  };

  const { data: unreadData, refetch: refetchUnread } =
    useQuery<GetMyUnreadChatCountQueryData>(GET_MY_UNREAD_CHAT_COUNT_QUERY, {
      skip: !canPollUnread,
      fetchPolicy: "cache-and-network",
      nextFetchPolicy: "cache-and-network",
      pollInterval: UNREAD_POLL_INTERVAL_MS,
    });

  const unreadCount = unreadData?.getMyUnreadChatCount ?? 0;

  // ── Notification unread count ──
  const { data: notifUnreadData, refetch: refetchNotifUnread } = useQuery<{
    getUnreadCount: number;
  }>(GET_UNREAD_COUNT_QUERY, {
    skip: !canTrackUnread,
    fetchPolicy: "cache-and-network",
    nextFetchPolicy: "cache-and-network",
    pollInterval: NOTIFICATION_POLL_INTERVAL_MS,
  });

  const notifUnreadCount = notifUnreadData?.getUnreadCount ?? 0;

  // ── Notification socket ──
  const handleNotificationEvent = useCallback(
    (payload: { title?: string; message?: string }) => {
      void refetchNotifUnread();
      const text =
        payload?.title || payload?.message || "You have a new notification.";
      toast.info(text);
    },
    [refetchNotifUnread, toast],
  );

  useEffect(() => {
    if (!member) return;
    const token = getAccessToken();
    if (!token) return;

    const socket = createNotificationSocket(token);

    socket.on("connect", () => {
      socket.emit("authenticate", { token: `Bearer ${token}` });
    });

    socket.on("notification", handleNotificationEvent);

    return () => {
      socket.off("notification", handleNotificationEvent);
      socket.disconnect();
    };
  }, [member, handleNotificationEvent]);

  useEffect(() => {
    if (!canPollUnread) {
      hasPolledOnVisibleRef.current = false;
      return;
    }
    if (!hasPolledOnVisibleRef.current) {
      hasPolledOnVisibleRef.current = true;
      void refetchUnread();
    }
  }, [canPollUnread, refetchUnread]);

  useEffect(() => {
    setIsMobileMenuOpen(false);
    setIsChatPanelOpen(false);
  }, [router.asPath]);

  useEffect(() => {
    if (!canTrackUnread) {
      previousUnreadRef.current = null;
      return;
    }
    if (!canPollUnread) return;

    const previousUnread = previousUnreadRef.current;
    if (
      previousUnread !== null &&
      unreadCount > previousUnread &&
      router.pathname !== "/chats/[chatId]"
    ) {
      const delta = unreadCount - previousUnread;
      toast.info(
        delta === 1
          ? "You have 1 new chat message."
          : `You have ${delta} new chat messages.`,
      );
    }

    previousUnreadRef.current = unreadCount;
  }, [canPollUnread, canTrackUnread, router.pathname, toast, unreadCount]);

  // Chat icon button — only for logged-in members not already on chat routes
  const chatIconButton =
    member && !isChatRoute ? (
      <button
        type="button"
        onClick={() => setIsChatPanelOpen((prev) => !prev)}
        className="relative flex h-8 w-8 items-center justify-center rounded-full text-slate-500 transition hover:bg-slate-100"
        aria-label="Open chat"
      >
        <MessageSquare size={17} />
        {unreadCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-sky-500 px-0.5 text-[9px] font-bold text-white">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>
    ) : null;

  // Notification bell button with drawer
  const notifBellButton = member ? (
    <NotificationBellDrawer
      unreadCount={notifUnreadCount}
      onCountChange={() => {
        void refetchNotifUnread();
      }}
    />
  ) : null;

  const sharedHeader = (
    <header className="sticky top-0 z-90 w-screen border-b border-slate-200/70 bg-white/85 backdrop-blur-md">
      <div className="mx-auto flex h-[57px] w-full max-w-6xl items-center justify-between px-3 sm:px-6">
        {/* Logo */}
        <Link
          href="/"
          className="font-display text-lg font-semibold tracking-[0.12em] text-slate-800"
        >
          MEOMUL
        </Link>

        {/* Desktop nav */}
        <div className="hidden items-center gap-1 md:flex">
          <nav className="flex items-center gap-0.5">
            {navLinks.map((link) => {
              const active = isActive(router.pathname, link.href);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                    active
                      ? "bg-slate-900 text-white"
                      : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                  }`}
                >
                  {link.label}
                </Link>
              );
            })}
          </nav>

          {/* Divider + right-side actions */}
          <div className="ml-2 flex items-center gap-2 border-l border-slate-200 pl-2">
            {member ? (
              <>
                {notifBellButton}
                {chatIconButton}
                <UserAvatarMenu member={memberWithLiveImage ?? member} onLogout={handleLogout} />
              </>
            ) : (
              <>
                <Link
                  href="/auth/login"
                  className="rounded-lg px-3 py-1.5 text-sm font-medium text-slate-600 transition hover:bg-slate-100"
                >
                  Log in
                </Link>
                <Link
                  href="/auth/signup"
                  className="rounded-full bg-sky-500 px-4 py-1.5 text-sm font-semibold text-white shadow-sm transition hover:bg-sky-600"
                >
                  Sign up
                </Link>
              </>
            )}
          </div>
        </div>

        {/* Mobile: notification bell + chat icon + hamburger */}
        <div className="flex items-center gap-1.5 md:hidden">
          {notifBellButton}
          {chatIconButton}
          <button
            type="button"
            onClick={() => setIsMobileMenuOpen((prev) => !prev)}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-600 transition hover:bg-slate-100"
            aria-label="Toggle menu"
            aria-expanded={isMobileMenuOpen}
          >
            {isMobileMenuOpen ? (
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                className="h-5 w-5"
              >
                <path d="M6 18L18 6M6 6l12 12" />
              </svg>
            ) : (
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                className="h-5 w-5"
              >
                <path d="M4 7h16M4 12h16M4 17h16" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {isMobileMenuOpen && (
        <div
          id="mobile-main-nav"
          className="border-t border-slate-100 bg-white/95 backdrop-blur-md md:hidden"
        >
          <div className="mx-auto max-w-6xl px-3 py-3">
            {/* Logged-in member card */}
            {member && (
              <div className="mb-3 flex items-center gap-3 rounded-xl bg-slate-50 px-3 py-2.5">
                <div
                  className={`flex h-9 w-9 flex-shrink-0 items-center justify-center overflow-hidden rounded-full ${ROLE_COLOR[member.memberType] ?? "bg-slate-500"} text-[11px] font-bold text-white`}
                >
                  {memberAvatar(memberWithLiveImage ?? member)}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-slate-900">
                    {member.memberNick}
                  </p>
                  <p className="text-[11px] capitalize text-slate-400">
                    {member.memberType.replace("_", " ").toLowerCase()}
                  </p>
                </div>
              </div>
            )}

            {/* Role-based nav links */}
            <nav className="flex flex-col gap-0.5">
              {navLinks.map((link) => {
                const active = isActive(router.pathname, link.href);
                return (
                  <Link
                    key={`mobile-${link.href}`}
                    href={link.href}
                    className={`rounded-lg px-3 py-2.5 text-sm font-medium transition ${
                      active
                        ? "bg-slate-900 text-white"
                        : "text-slate-700 hover:bg-slate-100"
                    }`}
                  >
                    {link.label}
                  </Link>
                );
              })}
            </nav>

            {/* Bottom section: settings/logout or auth buttons */}
            <div className="mt-3 border-t border-slate-100 pt-3">
              {member ? (
                <div className="flex flex-col gap-0.5">
                  <Link
                    href="/profile"
                    className="flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm text-slate-600 transition hover:bg-slate-100"
                  >
                    <User size={15} className="text-slate-400" />
                    Profile
                  </Link>
                  {member.memberType === "USER" && (
                    <>
                      <Link
                        href="/profile?tab=subscription"
                        className="flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm text-slate-600 transition hover:bg-slate-100"
                      >
                        <Crown size={15} className="text-slate-400" />
                        Subscription
                      </Link>
                      <Link
                        href="/profile?tab=reviews"
                        className="flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm text-slate-600 transition hover:bg-slate-100"
                      >
                        <Star size={15} className="text-slate-400" />
                        My Reviews
                      </Link>
                      <Link
                        href="/profile?tab=likes"
                        className="flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm text-slate-600 transition hover:bg-slate-100"
                      >
                        <Heart size={15} className="text-slate-400" />
                        Saved Hotels
                      </Link>
                    </>
                  )}
                  <Link
                    href="/settings/preferences"
                    className="flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm text-slate-600 transition hover:bg-slate-100"
                  >
                    <Settings size={15} className="text-slate-400" />
                    Settings
                  </Link>
                  <button
                    type="button"
                    onClick={handleLogout}
                    className="flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm text-rose-500 transition hover:bg-rose-50"
                  >
                    <LogOut size={15} />
                    Sign out
                  </button>
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  <Link
                    href="/auth/login"
                    className="rounded-xl border border-slate-200 px-4 py-2.5 text-center text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                  >
                    Log in
                  </Link>
                  <Link
                    href="/auth/signup"
                    className="rounded-xl bg-sky-500 px-4 py-2.5 text-center text-sm font-semibold text-white shadow-sm transition hover:bg-sky-600"
                  >
                    Sign up
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </header>
  );

  return (
    <div className="min-h-screen w-screen overflow-x-clip">
      {sharedHeader}
      {isHomeRoute ? (
        children
      ) : (
        <div className="mx-auto w-full max-w-6xl px-3 py-8 sm:px-6 sm:py-10">
          {children}
        </div>
      )}
      {!isHomeRoute && <PriceLockFab />}
      <ChatDrawer
        isOpen={isChatPanelOpen}
        onClose={() => setIsChatPanelOpen(false)}
        unreadCount={unreadCount}
      />
    </div>
  );
}
