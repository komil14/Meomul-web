import { useMutation, useQuery } from "@apollo/client/react";
import { useRouter } from "next/router";
import { useEffect, useMemo, useRef, useState } from "react";
import type { ChangeEvent, FormEvent } from "react";
import { ProfileNav } from "@/components/profile/profile-nav";
import { ReviewsTab } from "@/components/profile/reviews-tab";
import { LikesTab } from "@/components/profile/likes-tab";
import { SubscriptionTab } from "@/components/profile/subscription-tab";
import { ErrorNotice } from "@/components/ui/error-notice";
import { useToast } from "@/components/ui/toast-provider";
import { GET_MEMBER_QUERY, UPDATE_MEMBER_MUTATION } from "@/graphql/member.gql";
import { getSessionMember } from "@/lib/auth/session";
import { getErrorMessage } from "@/lib/utils/error";
import { Camera, Crown, Lock, MapPin, Star } from "lucide-react";
import type { NextPageWithAuth } from "@/types/page";

// ─── Types ────────────────────────────────────────────────────────────────────

interface MemberDto {
  _id: string;
  memberType: string;
  memberStatus: string;
  memberPhone: string;
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

interface GetMemberData {
  getMember: MemberDto;
}

// ─── Style maps ───────────────────────────────────────────────────────────────

const AVATAR_BG: Record<string, string> = {
  USER: "bg-sky-500",
  AGENT: "bg-violet-500",
  ADMIN: "bg-rose-500",
  ADMIN_OPERATOR: "bg-rose-500",
};

const ROLE_PILL: Record<string, string> = {
  USER: "border-sky-400/40 bg-sky-400/20 text-sky-200",
  AGENT: "border-violet-400/40 bg-violet-400/20 text-violet-200",
  ADMIN: "border-rose-400/40 bg-rose-400/20 text-rose-200",
  ADMIN_OPERATOR: "border-rose-400/40 bg-rose-400/20 text-rose-200",
};

const TIER_PILL: Record<string, string> = {
  FREE: "border-slate-400/40 bg-slate-400/15 text-slate-300",
  BASIC: "border-sky-400/40 bg-sky-400/15 text-sky-200",
  PREMIUM: "border-violet-400/40 bg-violet-400/15 text-violet-200",
  ELITE: "border-amber-400/40 bg-amber-400/15 text-amber-200",
};

const TIER_LABEL: Record<string, string> = {
  FREE: "Free", BASIC: "Basic", PREMIUM: "Premium", ELITE: "Elite",
};

// ─── Page ─────────────────────────────────────────────────────────────────────

const ProfilePage: NextPageWithAuth = () => {
  const router = useRouter();
  const toast = useToast();
  const sessionMember = useMemo(() => getSessionMember(), []);
  const fileRef = useRef<HTMLInputElement>(null);

  const activeTab = (router.query.tab as string) ?? "profile";

  const [uploading, setUploading] = useState(false);
  const [nick, setNick] = useState("");
  const [fullName, setFullName] = useState("");
  const [address, setAddress] = useState("");
  const [desc, setDesc] = useState("");
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [hasLoaded, setHasLoaded] = useState(false);

  useEffect(() => {
    if (!sessionMember) void router.replace("/auth/login");
  }, [sessionMember, router]);

  const { data, loading, error } = useQuery<GetMemberData>(GET_MEMBER_QUERY, {
    skip: !sessionMember,
    fetchPolicy: "cache-and-network",
    nextFetchPolicy: "cache-and-network",
  });

  const [updateMember, { loading: saving }] = useMutation(UPDATE_MEMBER_MUTATION);

  const member = data?.getMember;

  useEffect(() => {
    if (member && !hasLoaded) {
      setNick(member.memberNick ?? "");
      setFullName(member.memberFullName ?? "");
      setAddress(member.memberAddress ?? "");
      setDesc(member.memberDesc ?? "");
      setImageUrl(member.memberImage ?? null);
      setHasLoaded(true);
    }
  }, [member, hasLoaded]);

  const handleImageChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch(`${apiUrl}/upload/image?target=member`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${typeof window !== "undefined" ? (localStorage.getItem("accessToken") ?? "") : ""}`,
        },
        body: formData,
      });
      if (!res.ok) throw new Error("Upload failed");
      const json = (await res.json()) as { url: string };
      setImageUrl(json.url);
    } catch (err) {
      toast.error("Image upload failed. Please try again.");
      console.error(err);
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!nick.trim() || nick.trim().length < 3) {
      toast.error("Display name must be at least 3 characters.");
      return;
    }
    try {
      await updateMember({
        variables: {
          input: {
            memberNick: nick.trim(),
            memberFullName: fullName.trim() || undefined,
            memberAddress: address.trim() || undefined,
            memberDesc: desc.trim() || undefined,
            memberImage: imageUrl || undefined,
          },
        },
      });
      toast.success("Profile updated.");
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  if (!sessionMember) return null;

  const memberType = member?.memberType ?? sessionMember.memberType;
  const memberNick = member?.memberNick ?? sessionMember.memberNick;
  const initials = memberNick.slice(0, 2).toUpperCase();
  const avatarBg = AVATAR_BG[memberType] ?? "bg-slate-600";
  const tier = member?.subscriptionTier ?? "FREE";

  const STATS = member
    ? [
        { label: "Loyalty points", value: member.memberPoints.toLocaleString(), sub: "earned" },
        { label: "Followers", value: member.memberFollowers.toLocaleString(), sub: "members" },
        { label: "Following", value: member.memberFollowings.toLocaleString(), sub: "members" },
      ]
    : [];

  return (
    <main className="mx-auto max-w-3xl space-y-5">

      {/* ── Hero ──────────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden rounded-[2rem] bg-slate-950 shadow-xl">
        <div className="absolute inset-0 bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950/80" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_top_right,rgba(99,102,241,0.18),transparent)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_50%_at_bottom_left,rgba(14,165,233,0.12),transparent)]" />
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />

        <div className="relative p-6 sm:p-8 lg:p-10">
          <div className="flex items-start gap-5 sm:gap-6">

            {/* Avatar */}
            <div className="relative flex-shrink-0">
              <div
                className={`flex h-20 w-20 items-center justify-center overflow-hidden rounded-2xl ring-2 ring-white/20 ${avatarBg} text-2xl font-bold text-white sm:h-24 sm:w-24 sm:rounded-3xl`}
              >
                {imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={imageUrl} alt={initials} className="h-full w-full object-cover" />
                ) : (
                  <span>{initials}</span>
                )}
              </div>
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
                aria-label="Change avatar"
                className="absolute -bottom-2 -right-2 flex h-7 w-7 items-center justify-center rounded-full border border-white/25 bg-white/15 text-white backdrop-blur-md transition hover:bg-white/25 disabled:opacity-60"
              >
                {uploading
                  ? <div className="h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  : <Camera size={13} />
                }
              </button>
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleImageChange} />
            </div>

            {/* Name, full name, badges */}
            <div className="min-w-0 flex-1 pt-0.5">
              <h1 className="text-2xl font-bold leading-tight text-white sm:text-3xl">
                {memberNick}
              </h1>
              {member?.memberFullName && (
                <p className="mt-0.5 text-sm text-slate-400">{member.memberFullName}</p>
              )}

              <div className="mt-3 flex flex-wrap gap-2">
                <span className={`rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.13em] ${ROLE_PILL[memberType] ?? "border-slate-400/40 bg-slate-400/20 text-slate-300"}`}>
                  {memberType.replace("_", " ").toLowerCase()}
                </span>
                <span className={`flex items-center gap-1 rounded-full border px-3 py-1 text-[11px] font-semibold ${TIER_PILL[tier] ?? TIER_PILL.FREE}`}>
                  <Crown size={10} />
                  {TIER_LABEL[tier] ?? tier}
                </span>
                {member && member.memberRank > 0 && (
                  <span className="flex items-center gap-1 rounded-full border border-amber-400/40 bg-amber-400/15 px-3 py-1 text-[11px] font-semibold text-amber-200">
                    <Star size={10} className="fill-amber-300 text-amber-300" />
                    {member.memberRank.toFixed(1)} rated
                  </span>
                )}
              </div>

              {member?.memberAddress && (
                <p className="mt-2.5 flex items-center gap-1.5 text-xs text-slate-400">
                  <MapPin size={11} className="flex-shrink-0" />
                  {member.memberAddress}
                </p>
              )}
            </div>
          </div>

          {member?.memberDesc && (
            <p className="mt-6 text-sm leading-relaxed text-slate-300/85 sm:max-w-lg">
              {member.memberDesc}
            </p>
          )}

          {STATS.length > 0 && (
            <div className="my-6 h-px bg-gradient-to-r from-transparent via-white/15 to-transparent" />
          )}

          {STATS.length > 0 && (
            <div className="grid grid-cols-3 gap-3">
              {STATS.map(({ label, value, sub }) => (
                <article
                  key={label}
                  className="rounded-2xl border border-white/15 bg-white/8 px-4 py-4 backdrop-blur-sm transition hover:bg-white/12"
                >
                  <p className="text-[10px] font-medium uppercase tracking-[0.15em] text-slate-400">
                    {label}
                  </p>
                  <p className="mt-2 text-3xl font-semibold leading-none text-white">{value}</p>
                  <p className="mt-1.5 text-[10px] text-slate-500">{sub}</p>
                </article>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* ── Nav ───────────────────────────────────────────────────────────── */}
      <ProfileNav />

      {/* ── Tab content ───────────────────────────────────────────────────── */}
      {activeTab === "profile" && (
        <>
          {error && <ErrorNotice message={getErrorMessage(error)} />}

          {loading && !member ? (
            <div className="space-y-3">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-12 animate-pulse rounded-2xl bg-slate-100" />
              ))}
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
                <div className="border-b border-slate-50 bg-slate-50/60 px-5 py-3.5">
                  <h2 className="text-sm font-semibold text-slate-700">Edit profile</h2>
                </div>

                <div className="space-y-4 p-5">
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-slate-700">
                      Display name <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={nick}
                      onChange={(e) => setNick(e.target.value)}
                      minLength={3}
                      maxLength={20}
                      required
                      className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none transition focus:border-slate-400 focus:ring-1 focus:ring-slate-300"
                    />
                  </div>

                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-slate-700">Full name</label>
                    <input
                      type="text"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      maxLength={80}
                      className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none transition focus:border-slate-400 focus:ring-1 focus:ring-slate-300"
                    />
                  </div>

                  {member?.memberPhone && (
                    <div>
                      <label className="mb-1.5 block text-sm font-medium text-slate-700">Phone</label>
                      <div className="flex items-center gap-2 rounded-xl border border-slate-100 bg-slate-50 px-3 py-2.5 text-sm text-slate-500">
                        <span className="flex-1">{member.memberPhone}</span>
                        <Lock size={12} className="flex-shrink-0 text-slate-300" />
                        <span className="text-[11px] text-slate-400">Read-only</span>
                      </div>
                    </div>
                  )}

                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-slate-700">Address</label>
                    <input
                      type="text"
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                      maxLength={200}
                      placeholder="City, District..."
                      className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none transition focus:border-slate-400 focus:ring-1 focus:ring-slate-300"
                    />
                  </div>

                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-slate-700">About me</label>
                    <textarea
                      value={desc}
                      onChange={(e) => setDesc(e.target.value)}
                      maxLength={300}
                      rows={3}
                      placeholder="Tell us a bit about yourself..."
                      className="w-full resize-none rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none transition focus:border-slate-400 focus:ring-1 focus:ring-slate-300"
                    />
                    <span className="mt-0.5 block text-right text-xs text-slate-400">{desc.length}/300</span>
                  </div>
                </div>
              </div>

              <button
                type="submit"
                disabled={saving}
                className="w-full rounded-2xl bg-slate-900 py-3.5 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-700 disabled:opacity-60"
              >
                {saving ? "Saving..." : "Save changes"}
              </button>
            </form>
          )}
        </>
      )}

      {activeTab === "reviews" && memberType === "USER" && <ReviewsTab />}
      {activeTab === "likes" && memberType === "USER" && <LikesTab />}
      {activeTab === "subscription" && memberType === "USER" && <SubscriptionTab />}
    </main>
  );
};

ProfilePage.auth = {
  roles: ["USER", "AGENT", "ADMIN", "ADMIN_OPERATOR"],
};

export default ProfilePage;
