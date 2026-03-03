import { useRouter } from "next/router";
import { useMemo } from "react";
import { getSessionMember } from "@/lib/auth/session";

const TABS = [
  { id: "profile", label: "Overview" },
  { id: "reviews", label: "Reviews", userOnly: true },
  { id: "likes", label: "Saved Hotels", userOnly: true },
  { id: "bookings", label: "Bookings", userOnly: true },
  { id: "subscription", label: "Subscription", userOnly: true },
] as const;

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
      className="flex gap-0.5 overflow-x-auto border-b border-slate-200"
    >
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => goTo(tab.id)}
            className={`-mb-px flex-shrink-0 border-b-2 px-4 py-3 text-sm font-semibold transition ${
              isActive
                ? "border-slate-900 text-slate-900"
                : "border-transparent text-slate-400 hover:text-slate-600"
            }`}
          >
            {tab.label}
          </button>
        );
      })}
    </nav>
  );
}
