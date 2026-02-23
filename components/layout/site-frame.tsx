import { useQuery } from "@apollo/client/react";
import Link from "next/link";
import { useRouter } from "next/router";
import { useEffect, useMemo, useRef } from "react";
import type { PropsWithChildren } from "react";
import { useToast } from "@/components/ui/toast-provider";
import { GET_MY_UNREAD_CHAT_COUNT_QUERY } from "@/graphql/chat.gql";
import { getSessionMember } from "@/lib/auth/session";
import type { GetMyUnreadChatCountQueryData } from "@/types/chat";

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
  const member = useMemo(() => getSessionMember(), []);
  const canTrackUnread = Boolean(member);
  const previousUnreadRef = useRef<number | null>(null);

  const { data: unreadData } = useQuery<GetMyUnreadChatCountQueryData>(GET_MY_UNREAD_CHAT_COUNT_QUERY, {
    skip: !canTrackUnread,
    fetchPolicy: "network-only",
    pollInterval: 10000,
  });

  const unreadCount = unreadData?.getMyUnreadChatCount ?? 0;

  useEffect(() => {
    if (!canTrackUnread) {
      previousUnreadRef.current = null;
      return;
    }

    const previousUnread = previousUnreadRef.current;
    if (previousUnread !== null && unreadCount > previousUnread && router.pathname !== "/chats/[chatId]") {
      const delta = unreadCount - previousUnread;
      toast.info(delta === 1 ? "You have 1 new chat message." : `You have ${delta} new chat messages.`);
    }

    previousUnreadRef.current = unreadCount;
  }, [canTrackUnread, router.pathname, toast, unreadCount]);

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-10 border-b border-white/50 bg-white/70 backdrop-blur">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-4">
          <Link href="/" className="font-display text-lg font-semibold tracking-[0.12em] text-slate-800">
            MEOMUL
          </Link>
          <nav className="flex flex-wrap items-center gap-1">
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
      </header>
      <div className="mx-auto w-full max-w-6xl px-6 py-10">{children}</div>
    </div>
  );
}
