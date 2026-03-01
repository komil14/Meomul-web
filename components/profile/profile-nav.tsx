import { useRouter } from "next/router";
import { useMemo } from "react";
import { getSessionMember } from "@/lib/auth/session";

const TABS = [
  { id: "profile", label: "Profile", userOnly: false },
  { id: "reviews", label: "My Reviews", userOnly: true },
  { id: "likes", label: "Saved Hotels", userOnly: true },
  { id: "subscription", label: "Subscription", userOnly: true },
];

export function ProfileNav() {
  const router = useRouter();
  const member = useMemo(() => getSessionMember(), []);
  const activeTab = (router.query.tab as string) ?? "profile";
  const tabs = TABS.filter((t) => !t.userOnly || member?.memberType === "USER");

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
      className="flex gap-1 overflow-x-auto rounded-2xl border border-slate-100 bg-white p-1.5 shadow-sm"
    >
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => goTo(tab.id)}
            className={`flex-shrink-0 rounded-xl px-4 py-2 text-sm font-medium transition ${
              isActive
                ? "bg-slate-900 text-white shadow-sm"
                : "text-slate-500 hover:bg-slate-50 hover:text-slate-700"
            }`}
          >
            {tab.label}
          </button>
        );
      })}
    </nav>
  );
}
