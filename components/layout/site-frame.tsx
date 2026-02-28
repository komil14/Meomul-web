import { useQuery } from "@apollo/client/react";
import Link from "next/link";
import { useRouter } from "next/router";
import { useEffect, useRef, useState } from "react";
import type { PropsWithChildren } from "react";
import { ChatDrawer } from "@/components/chat/chat-drawer";
import { PriceLockFab } from "@/components/layout/price-lock-fab";
import { useToast } from "@/components/ui/toast-provider";
import { GET_MY_UNREAD_CHAT_COUNT_QUERY } from "@/graphql/chat.gql";
import { clearAuthSession, getSessionMember } from "@/lib/auth/session";
import { usePageVisible } from "@/lib/hooks/use-page-visible";
import type { SessionMember } from "@/types/auth";
import type { GetMyUnreadChatCountQueryData } from "@/types/chat";
import { LogOut, MessageSquare, Settings } from "lucide-react";

const UNREAD_POLL_INTERVAL_MS = 120000;

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
} as const;

function getNavLinks(member: SessionMember | null) {
  if (!member) return NAV_LINKS.guest;
  if (member.memberType === "USER") return NAV_LINKS.user;
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
        <img src={member.memberImage} alt={initials} className="h-full w-full object-cover" />
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
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
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
            <p className="truncate text-sm font-semibold text-slate-900">{member.memberNick}</p>
            <p className="text-[11px] capitalize text-slate-400">{roleLabel}</p>
          </div>
          <div className="py-1">
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

  const isPageVisible = usePageVisible();
  const canTrackUnread = Boolean(member);
  const isChatRoute = router.pathname === "/chats" || router.pathname === "/chats/[chatId]";
  const canPollUnread = canTrackUnread && isPageVisible && !isChatRoute;
  const previousUnreadRef = useRef<number | null>(null);
  const hasPolledOnVisibleRef = useRef(false);

  const navLinks = getNavLinks(member);

  const handleLogout = () => {
    clearAuthSession();
    void router.push("/auth/login");
  };

  const { data: unreadData, refetch: refetchUnread } = useQuery<GetMyUnreadChatCountQueryData>(
    GET_MY_UNREAD_CHAT_COUNT_QUERY,
    {
      skip: !canPollUnread,
      fetchPolicy: "cache-and-network",
      nextFetchPolicy: "cache-and-network",
      pollInterval: UNREAD_POLL_INTERVAL_MS,
    },
  );

  const unreadCount = unreadData?.getMyUnreadChatCount ?? 0;

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
        delta === 1 ? "You have 1 new chat message." : `You have ${delta} new chat messages.`,
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

  const sharedHeader = (
    <header className="sticky top-0 z-30 w-screen border-b border-slate-200/70 bg-white/85 backdrop-blur-md">
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
                {chatIconButton}
                <UserAvatarMenu member={member} onLogout={handleLogout} />
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

        {/* Mobile: chat icon + hamburger */}
        <div className="flex items-center gap-1.5 md:hidden">
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
                  {memberAvatar(member)}
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
        <div className="mx-auto w-full max-w-6xl px-3 py-8 sm:px-6 sm:py-10">{children}</div>
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
