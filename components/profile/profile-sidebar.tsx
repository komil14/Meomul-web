import { useMemo } from "react";
import { Crown, MapPin, Pencil, Star } from "lucide-react";
import { resolveMediaUrl } from "@/lib/utils/media-url";
import { getSessionMember } from "@/lib/auth/session";

// ─── Constants ────────────────────────────────────────────────────────────────

const AVATAR_BG: Record<string, string> = {
  USER: "bg-sky-500",
  AGENT: "bg-violet-500",
  ADMIN: "bg-rose-500",
  ADMIN_OPERATOR: "bg-rose-500",
};

const TIER_LABEL: Record<string, string> = {
  FREE: "Free",
  BASIC: "Basic",
  PREMIUM: "Premium",
  ELITE: "Elite",
};

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ProfileMember {
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

interface ProfileHeaderProps {
  member?: ProfileMember | null;
  loading?: boolean;
  onEdit: () => void;
}

// ─── Stat ─────────────────────────────────────────────────────────────────────

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="text-center">
      <p className="text-lg font-bold tracking-tight text-slate-900">{value}</p>
      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">
        {label}
      </p>
    </div>
  );
}

// ─── ProfileHeader ────────────────────────────────────────────────────────────

export function ProfileHeader({ member, loading, onEdit }: ProfileHeaderProps) {
  const sessionMember = useMemo(() => getSessionMember(), []);

  const memberType = member?.memberType ?? sessionMember?.memberType ?? "USER";
  const memberNick = member?.memberNick ?? sessionMember?.memberNick ?? "";
  const initials = memberNick.slice(0, 2).toUpperCase();
  const avatarBg = AVATAR_BG[memberType] ?? "bg-slate-500";
  const tier = member?.subscriptionTier ?? "FREE";
  const tierLabel = TIER_LABEL[tier] ?? tier;
  const memberSince = member
    ? new Date(member.createdAt).toLocaleDateString("en-US", {
        month: "short",
        year: "numeric",
      })
    : "";

  // ── Loading skeleton ──────────────────────────────────────────────────
  if (loading && !member) {
    return (
      <div className="overflow-hidden rounded-3xl border border-slate-200/90 bg-white shadow-[0_12px_26px_-20px_rgba(15,23,42,0.28)]">
        <div className="flex flex-col items-center gap-5 p-6 sm:flex-row sm:items-start">
          <div className="h-20 w-20 flex-shrink-0 animate-pulse rounded-full bg-slate-100" />
          <div className="flex-1 space-y-2.5">
            <div className="h-3 w-24 animate-pulse rounded-full bg-slate-50" />
            <div className="h-6 w-40 animate-pulse rounded-full bg-slate-100" />
            <div className="h-4 w-32 animate-pulse rounded-full bg-slate-50" />
          </div>
        </div>
        <div className="flex justify-around border-t border-slate-100 px-6 py-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="text-center">
              <div className="mx-auto h-5 w-10 animate-pulse rounded-full bg-slate-100" />
              <div className="mx-auto mt-1.5 h-3 w-14 animate-pulse rounded-full bg-slate-50" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-3xl border border-slate-200/90 bg-white shadow-[0_12px_26px_-20px_rgba(15,23,42,0.28)]">
      {/* Identity row */}
      <div className="flex flex-col gap-5 p-6 sm:flex-row sm:items-center">
        {/* Avatar */}
        <div
          className={`h-20 w-20 flex-shrink-0 overflow-hidden rounded-full ${avatarBg} flex items-center justify-center text-2xl font-bold text-white ring-4 ring-white shadow-lg`}
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

        {/* Name + meta */}
        <div className="min-w-0 flex-1">
          {memberSince && (
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
              Member since {memberSince}
            </p>
          )}
          <h1 className="mt-0.5 font-display text-2xl font-bold tracking-tight text-slate-900">
            {memberNick}
          </h1>
          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm text-slate-500">
            {member?.memberFullName && <span>{member.memberFullName}</span>}
            {member?.memberFullName && member?.memberAddress && (
              <span className="text-slate-300">&middot;</span>
            )}
            {member?.memberAddress && (
              <span className="inline-flex items-center gap-1">
                <MapPin size={12} className="text-slate-400" />
                {member.memberAddress}
              </span>
            )}
          </div>
          <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
            <span className="rounded-full border border-slate-200 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
              {memberType.replace("_", " ").toLowerCase()}
            </span>
            <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
              <Crown size={9} />
              {tierLabel}
            </span>
            {member && member.memberRank > 0 && (
              <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                <Star size={9} className="fill-amber-400 text-amber-400" />
                {member.memberRank.toFixed(1)}
              </span>
            )}
          </div>
        </div>

        {/* Edit button */}
        <button
          type="button"
          onClick={onEdit}
          className="flex flex-shrink-0 items-center gap-2 self-start rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-400"
        >
          <Pencil size={14} />
          Edit profile
        </button>
      </div>

      {/* Stats bar */}
      {member && (
        <div className="flex items-center justify-around border-t border-slate-100 px-6 py-4">
          <Stat value={member.memberPoints.toLocaleString()} label="Points" />
          <div className="h-6 w-px bg-slate-100" />
          <Stat
            value={member.memberFollowers.toLocaleString()}
            label="Followers"
          />
          <div className="h-6 w-px bg-slate-100" />
          <Stat
            value={member.memberFollowings.toLocaleString()}
            label="Following"
          />
        </div>
      )}
    </div>
  );
}
