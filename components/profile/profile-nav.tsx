import { useRouter } from "next/router";
import { useMemo } from "react";
import { getSessionMember } from "@/lib/auth/session";

const TABS = [
  { id: "profile", label: "Profile", userOnly: false },
  { id: "reviews", label: "My Reviews", userOnly: true },
  { id: "likes", label: "Saved Hotels", userOnly: true },
  { id: "bookings", label: "My Bookings", userOnly: true },
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
      className="flex border-b border-slate-200"
    >
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => goTo(tab.id)}
            className={`-mb-px border-b-2 px-4 py-2.5 text-sm font-medium transition ${
              isActive
                ? "border-slate-900 text-slate-900"
                : "border-transparent text-slate-500 hover:text-slate-700"
            }`}
          >
            {tab.label}
          </button>
        );
      })}
    </nav>
  );
}
