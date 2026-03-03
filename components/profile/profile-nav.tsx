import { useRouter } from "next/router";
import { useMemo } from "react";
import { getSessionMember } from "@/lib/auth/session";

const TABS = [
  { id: "profile", label: "Overview" },
  { id: "reviews", label: "Reviews", userOnly: true },
  { id: "likes", label: "Saved", userOnly: true },
  { id: "bookings", label: "Bookings", userOnly: true },
  { id: "subscription", label: "Plan", userOnly: true },
] as const;

/**
 * Horizontal pill-style tab bar shown only on mobile (md:hidden).
 * On desktop the sidebar's vertical nav takes over.
 */
export function ProfileNav() {
  const router = useRouter();
  const member = useMemo(() => getSessionMember(), []);
  const activeTab = (router.query.tab as string) ?? "profile";
  const tabs = TABS.filter(
    (t) => !("userOnly" in t) || member?.memberType === "USER",
  );

  const goTo = (id: string) => {
    void router.push(
      { pathname: "/profile", query: id === "profile" ? {} : { tab: id } },
      undefined,
      { shallow: true },
    );
  };

  return (
    <nav
      aria-label="Profile sections"
      className="flex gap-1 overflow-x-auto rounded-xl bg-slate-100/80 p-1 md:hidden"
    >
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => goTo(tab.id)}
            className={`flex-shrink-0 rounded-lg px-3.5 py-2 text-sm font-medium transition ${
              isActive
                ? "bg-white text-slate-900 shadow-sm"
                : "text-slate-500 hover:text-slate-700"
            }`}
          >
            {tab.label}
          </button>
        );
      })}
    </nav>
  );
}
