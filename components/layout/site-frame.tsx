import { useQuery } from "@apollo/client/react";
import Link from "next/link";
import { useRouter } from "next/router";
import { useEffect, useMemo, useRef, useState } from "react";
import type { PropsWithChildren } from "react";
import { PriceLockFab } from "@/components/layout/price-lock-fab";
import { useToast } from "@/components/ui/toast-provider";
import { GET_MY_UNREAD_CHAT_COUNT_QUERY } from "@/graphql/chat.gql";
import { getSessionMember } from "@/lib/auth/session";
import { usePageVisible } from "@/lib/hooks/use-page-visible";
import type { GetMyUnreadChatCountQueryData } from "@/types/chat";

const UNREAD_POLL_INTERVAL_MS = 120000;

const links = [
  { href: "/", label: "Home" },
  { href: "/hotels", label: "Hotels" },
  { href: "/bookings/new", label: "New booking" },
  { href: "/bookings", label: "My bookings" },
  { href: "/bookings/manage", label: "Manage bookings" },
  { href: "/chats", label: "Chats" },
  { href: "/dashboard", label: "Dashboard" },
  { href: "/auth/login", label: "Login" },
  { href: "/auth/signup", label: "Signup" },
] as const;

const isActive = (pathname: string, href: string): boolean => {
  if (href === "/") {
    return pathname === "/";
  }

  return pathname === href || pathname.startsWith(`${href}/`);
};

export function SiteFrame({ children }: PropsWithChildren) {
  const router = useRouter();
  const toast = useToast();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const member = useMemo(() => getSessionMember(), []);
  const isPageVisible = usePageVisible();
  const canTrackUnread = Boolean(member);
  const isChatRoute = router.pathname === "/chats" || router.pathname === "/chats/[chatId]";
  const canPollUnread = canTrackUnread && isPageVisible && !isChatRoute;
  const previousUnreadRef = useRef<number | null>(null);
  const hasPolledOnVisibleRef = useRef(false);

  const { data: unreadData, refetch: refetchUnread } = useQuery<GetMyUnreadChatCountQueryData>(GET_MY_UNREAD_CHAT_COUNT_QUERY, {
    skip: !canPollUnread,
    fetchPolicy: "cache-first",
    nextFetchPolicy: "cache-first",
    pollInterval: UNREAD_POLL_INTERVAL_MS,
  });

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
  }, [router.asPath]);

  useEffect(() => {
    if (!canTrackUnread) {
      previousUnreadRef.current = null;
      return;
    }
    if (!canPollUnread) {
      return;
    }

    const previousUnread = previousUnreadRef.current;
    if (previousUnread !== null && unreadCount > previousUnread && router.pathname !== "/chats/[chatId]") {
      const delta = unreadCount - previousUnread;
      toast.info(delta === 1 ? "You have 1 new chat message." : `You have ${delta} new chat messages.`);
    }

    previousUnreadRef.current = unreadCount;
  }, [canPollUnread, canTrackUnread, router.pathname, toast, unreadCount]);

  return (
    <div className="min-h-screen w-screen overflow-x-clip">
      <header className="sticky top-0 z-30 w-screen border-b border-white/50 bg-white/70 backdrop-blur">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-3 py-4 sm:px-6">
          <Link href="/" className="font-display text-lg font-semibold tracking-[0.12em] text-slate-800">
            MEOMUL
          </Link>
          <button
            type="button"
            onClick={() => setIsMobileMenuOpen((previous) => !previous)}
            className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-slate-300 bg-white text-slate-700 md:hidden"
            aria-label="Toggle navigation menu"
            aria-expanded={isMobileMenuOpen}
            aria-controls="mobile-main-nav"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
              <path d="M4 7h16M4 12h16M4 17h16" />
            </svg>
          </button>
          <nav className="hidden flex-wrap items-center gap-1 md:flex">
            {links.map((link) => {
              const active = isActive(router.pathname, link.href);
              const showUnreadBadge = link.href === "/chats" && unreadCount > 0;

              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
                    active ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                  }`}
                >
                  <span className="inline-flex items-center gap-2">
                    {link.label}
                    {showUnreadBadge ? (
                      <span
                        className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${
                          active ? "bg-white text-slate-900" : "bg-slate-900 text-white"
                        }`}
                      >
                        {unreadCount > 99 ? "99+" : unreadCount}
                      </span>
                    ) : null}
                  </span>
                </Link>
              );
            })}
          </nav>
        </div>
        {isMobileMenuOpen ? (
          <div id="mobile-main-nav" className="border-t border-slate-200 bg-white px-3 py-3 md:hidden">
            <nav className="grid grid-cols-2 gap-2">
              {links.map((link) => {
                const active = isActive(router.pathname, link.href);
                const showUnreadBadge = link.href === "/chats" && unreadCount > 0;

                return (
                  <Link
                    key={`mobile-${link.href}`}
                    href={link.href}
                    className={`rounded-md px-3 py-2 text-sm font-medium transition ${
                      active ? "bg-slate-900 text-white" : "text-slate-700 hover:bg-slate-100 hover:text-slate-900"
                    }`}
                  >
                    <span className="inline-flex items-center gap-2">
                      {link.label}
                      {showUnreadBadge ? (
                        <span
                          className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${
                            active ? "bg-white text-slate-900" : "bg-slate-900 text-white"
                          }`}
                        >
                          {unreadCount > 99 ? "99+" : unreadCount}
                        </span>
                      ) : null}
                    </span>
                  </Link>
                );
              })}
            </nav>
          </div>
        ) : null}
      </header>
      <div className="mx-auto w-full max-w-6xl px-3 py-8 sm:px-6 sm:py-10">{children}</div>
      <PriceLockFab />
    </div>
  );
}
