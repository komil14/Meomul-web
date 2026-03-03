import { useRouter } from "next/router";
import { useMemo } from "react";
import {
  CalendarDays,
  Crown,
  Heart,
  MapPin,
  MessageSquare,
  Pencil,
  Star,
  User,
} from "lucide-react";
import { resolveMediaUrl } from "@/lib/utils/media-url";
import { getSessionMember } from "@/lib/auth/session";

// ─── Constants ────────────────────────────────────────────────────────────────

const AVATAR_BG: Record<string, string> = {
  USER: "bg-sky-500",
  AGENT: "bg-violet-500",
  ADMIN: "bg-rose-500",
  ADMIN_OPERATOR: "bg-rose-500",
};

const TIER_STYLE: Record<string, { label: string; cls: string }> = {
  FREE: { label: "Free", cls: "bg-slate-100 text-slate-600" },
  BASIC: { label: "Basic", cls: "bg-sky-50 text-sky-700" },
  PREMIUM: { label: "Premium", cls: "bg-violet-50 text-violet-700" },
  ELITE: { label: "Elite", cls: "bg-amber-50 text-amber-700" },
};

const SIDEBAR_TABS = [
  { id: "profile", label: "Overview", Icon: User },
  { id: "reviews", label: "My Reviews", Icon: MessageSquare, userOnly: true },
  { id: "likes", label: "Saved Hotels", Icon: Heart, userOnly: true },
  { id: "bookings", label: "My Bookings", Icon: CalendarDays, userOnly: true },
  { id: "subscription", label: "Subscription", Icon: Crown, userOnly: true },
] as const;

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SidebarMember {
  _id: string;
  memberType: string;
  memberNick: string;
  memberFullName?: string | null;
  memberImage?: string | null;
  memberAddress?: string | null;
  memberDesc?: string | null;
  subscriptionTier: string;
  memberPoints: number;
  memberFollowers: number;
  memberFollowings: number;
  memberRank: number;
  createdAt: string;
}

interface ProfileSidebarProps {
  member?: SidebarMember | null;
  loading?: boolean;
  onEdit: () => void;
}

// ─── Stat card ────────────────────────────────────────────────────────────────

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-slate-50/80 px-3 py-2.5 text-center transition hover:bg-slate-100/60">
      <p className="text-sm font-bold text-slate-900">{value}</p>
      <p className="text-[11px] text-muted">{label}</p>
    </div>
  );
}

// ─── ProfileSidebar ───────────────────────────────────────────────────────────

export function ProfileSidebar({
  member,
  loading,
  onEdit,
}: ProfileSidebarProps) {
  const router = useRouter();
  const sessionMember = useMemo(() => getSessionMember(), []);
  const activeTab = (router.query.tab as string) ?? "profile";

  const memberType = member?.memberType ?? sessionMember?.memberType ?? "USER";
  const memberNick = member?.memberNick ?? sessionMember?.memberNick ?? "";
  const initials = memberNick.slice(0, 2).toUpperCase();
  const avatarBg = AVATAR_BG[memberType] ?? "bg-slate-500";
  const tier = member?.subscriptionTier ?? "FREE";
  const tierStyle = TIER_STYLE[tier] ?? {
    label: tier,
    cls: "bg-slate-100 text-slate-600",
  };

  const tabs = SIDEBAR_TABS.filter(
    (t) => !("userOnly" in t) || memberType === "USER",
  );

  const goTo = (id: string) => {
    void router.push(
      { pathname: "/profile", query: id === "profile" ? {} : { tab: id } },
      undefined,
      { shallow: true },
    );
  };

  // ── Loading skeleton ──────────────────────────────────────────────────
  if (loading && !member) {
    return (
      <aside className="motion-fade-up">
        <div className="rounded-3xl bg-white p-6 shadow-[0_4px_24px_-8px_rgba(15,23,42,0.08)] border border-slate-100/80">
          <div className="flex flex-col items-center">
            <div className="h-24 w-24 animate-pulse rounded-full bg-slate-100" />
            <div className="mt-3 h-5 w-32 animate-pulse rounded-full bg-slate-100" />
            <div className="mt-2 h-4 w-24 animate-pulse rounded-full bg-slate-50" />
            <div className="mt-5 grid w-full grid-cols-2 gap-2.5">
              {[1, 2, 3, 4].map((i) => (
                <div
                  key={i}
                  className="h-14 animate-pulse rounded-xl bg-slate-50"
                />
              ))}
            </div>
          </div>
        </div>
      </aside>
    );
  }

  // ── Rendered sidebar ──────────────────────────────────────────────────
  return (
    <aside className="motion-fade-up">
      <div className="sticky top-6 rounded-3xl bg-white p-6 shadow-[0_4px_24px_-8px_rgba(15,23,42,0.08)] border border-slate-100/80">
        {/* Avatar + Identity */}
        <div className="flex flex-col items-center">
          <div
            className={`h-24 w-24 overflow-hidden rounded-full ${avatarBg} flex items-center justify-center text-3xl font-semibold text-white ring-4 ring-white shadow-lg`}
          >
            {member?.memberImage ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={resolveMediaUrl(member.memberImage)}
                alt={initials}
                className="h-full w-full object-cover"
              />
            ) : (
              <span>{initials}</span>
            )}
          </div>

          <h1 className="mt-3 text-center font-display text-xl font-bold text-slate-900">
            {memberNick}
          </h1>

          {member?.memberFullName && (
            <p className="text-sm text-muted">{member.memberFullName}</p>
          )}

          {/* Meta badges */}
          <div className="mt-2.5 flex flex-wrap items-center justify-center gap-1.5">
            <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-medium capitalize text-slate-600">
              {memberType.replace("_", " ").toLowerCase()}
            </span>
            <span
              className={`flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-medium ${tierStyle.cls}`}
            >
              <Crown size={10} />
              {tierStyle.label}
            </span>
            {member && member.memberRank > 0 && (
              <span className="flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-0.5 text-[11px] font-medium text-amber-700">
                <Star size={10} className="fill-amber-400 text-amber-400" />
                {member.memberRank.toFixed(1)}
              </span>
            )}
          </div>

          {member?.memberAddress && (
            <p className="mt-2 flex items-center gap-1 text-xs text-muted">
              <MapPin size={12} />
              {member.memberAddress}
            </p>
          )}

          {member?.memberDesc && (
            <p className="mt-3 text-center text-sm leading-relaxed text-slate-600">
              {member.memberDesc}
            </p>
          )}
        </div>

        {/* Divider */}
        <div className="my-5 border-t border-slate-100" />

        {/* Stats 2×2 grid */}
        {member && (
          <div className="grid grid-cols-2 gap-2.5">
            <StatCard
              label="Points"
              value={member.memberPoints.toLocaleString()}
            />
            <StatCard
              label="Followers"
              value={member.memberFollowers.toLocaleString()}
            />
            <StatCard
              label="Following"
              value={member.memberFollowings.toLocaleString()}
            />
            <StatCard
              label="Member since"
              value={new Date(member.createdAt).toLocaleDateString("en-US", {
                month: "short",
                year: "numeric",
              })}
            />
          </div>
        )}

        {/* Edit button */}
        <button
          type="button"
          onClick={onEdit}
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:border-slate-900 hover:text-slate-900"
        >
          <Pencil size={14} />
          Edit Profile
        </button>

        {/* Vertical nav — desktop only */}
        <div className="my-4 hidden border-t border-slate-100 md:block" />
        <nav
          className="hidden flex-col gap-1 md:flex"
          aria-label="Profile sections"
        >
          {tabs.map(({ id, label, Icon }) => {
            const isActive = activeTab === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => goTo(id)}
                className={`flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-[13px] font-medium transition-all duration-200 ${
                  isActive
                    ? "bg-slate-900 text-white shadow-sm"
                    : "text-slate-500 hover:bg-slate-50 hover:text-slate-800"
                }`}
              >
                <Icon size={16} />
                {label}
              </button>
            );
          })}
        </nav>
      </div>
    </aside>
  );
}
