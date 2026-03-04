import { useRouter } from "next/router";
import { useMemo } from "react";
import { getSessionMember } from "@/lib/auth/session";

const TABS = [
  { id: "profile", label: "Overview", access: "all" },
  { id: "reviews", label: "Reviews", access: "user+agent" },
  { id: "likes", label: "Saved Hotels", access: "user+agent" },
  { id: "bookings", label: "Bookings", access: "user+agent" },
  { id: "subscription", label: "Subscription", access: "user" },
] as const;

export function ProfileNav() {
  const router = useRouter();
  const member = useMemo(() => getSessionMember(), []);
  const activeTab = (router.query.tab as string) ?? "profile";
  const memberType = member?.memberType ?? "";
  const tabs = TABS.filter((t) => {
    if (t.access === "all") return true;
    if (t.access === "user") return memberType === "USER";
    if (t.access === "user+agent") return memberType === "USER" || memberType === "AGENT";
    return false;
  });

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
