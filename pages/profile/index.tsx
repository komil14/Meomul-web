import { useMutation, useQuery } from "@apollo/client/react";
import { useRouter } from "next/router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ChangeEvent, FormEvent } from "react";
import { ProfileNav } from "@/components/profile/profile-nav";
import { ReviewsTab } from "@/components/profile/reviews-tab";
import { LikesTab } from "@/components/profile/likes-tab";
import { SubscriptionTab } from "@/components/profile/subscription-tab";
import { BookingsTab } from "@/components/profile/bookings-tab";
import { ErrorNotice } from "@/components/ui/error-notice";
import { useToast } from "@/components/ui/toast-provider";
import { GET_MEMBER_QUERY, UPDATE_MEMBER_MUTATION } from "@/graphql/member.gql";
import {
  getAccessToken,
  getSessionMember,
  updateSessionMember,
} from "@/lib/auth/session";
import { env } from "@/lib/config/env";
import { getErrorMessage } from "@/lib/utils/error";
import { resolveMediaUrl } from "@/lib/utils/media-url";
import { Camera, Crown, Lock, MapPin, Star } from "lucide-react";
import type { NextPageWithAuth } from "@/types/page";

// ─── Constants ────────────────────────────────────────────────────────────────

const MAX_IMAGE_SIZE_MB = 5;
const MAX_IMAGE_SIZE_BYTES = MAX_IMAGE_SIZE_MB * 1024 * 1024;
const ACCEPTED_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

/** Derive the REST base URL from the GraphQL endpoint configured in env */
const getApiBaseUrl = (): string => {
  const gql = env.graphqlUrl;
  // Strip the trailing /graphql path to get the REST base
  return gql.replace(/\/graphql\/?$/i, "");
};

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

const TIER_LABEL: Record<string, string> = {
  FREE: "Free",
  BASIC: "Basic",
  PREMIUM: "Premium",
  ELITE: "Elite",
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

  // Track which tabs have been visited so we mount them once and keep them
  // alive (hidden via CSS) to avoid refetching when switching back.
  const [visitedTabs, setVisitedTabs] = useState<Set<string>>(
    () => new Set([activeTab]),
  );
  useEffect(() => {
    setVisitedTabs((prev) => {
      if (prev.has(activeTab)) return prev;
      return new Set(prev).add(activeTab);
    });
  }, [activeTab]);

  // Track whether the user has touched any form field so we don't
  // overwrite in-progress edits when Apollo emits a cache/network update.
  const dirtyRef = useRef(false);

  useEffect(() => {
    if (!sessionMember) void router.replace("/auth/login");
  }, [sessionMember, router]);

  const { data, loading, error } = useQuery<GetMemberData>(GET_MEMBER_QUERY, {
    skip: !sessionMember,
    fetchPolicy: "network-only",
    nextFetchPolicy: "cache-and-network",
  });

  const [updateMember, { loading: saving }] = useMutation(
    UPDATE_MEMBER_MUTATION,
  );

  const member = data?.getMember;

  // Derived server values for granular dependency tracking
  const memberNickServer = member?.memberNick ?? "";
  const memberFullServer = member?.memberFullName ?? "";
  const memberAddrServer = member?.memberAddress ?? "";
  const memberDescServer = member?.memberDesc ?? "";
  const memberImageServer = member?.memberImage ?? null;

  // Sync server → form state only when the form is NOT dirty (user hasn't
  // started editing). After a successful save we reset dirty, so the next
  // server emission re-populates the fields.
  useEffect(() => {
    if (member && !dirtyRef.current) {
      setNick(memberNickServer);
      setFullName(memberFullServer);
      setAddress(memberAddrServer);
      setDesc(memberDescServer);
      setImageUrl(memberImageServer);
    }
  }, [
    member,
    memberNickServer,
    memberFullServer,
    memberAddrServer,
    memberDescServer,
    memberImageServer,
  ]);

  // Keep session storage in sync so the site-frame avatar also updates
  useEffect(() => {
    if (member) {
      const session = getSessionMember();
      if (session && memberImageServer !== session.memberImage) {
        updateSessionMember({ memberImage: memberImageServer });
      }
    }
  }, [member, memberImageServer]);

  // Warn user before navigating away with unsaved edits
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (dirtyRef.current) {
        e.preventDefault();
      }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, []);

  // Helper to mark form as dirty whenever the user changes a text field
  const markDirty = useCallback(() => {
    dirtyRef.current = true;
  }, []);

  const handleImageChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // ── Client-side validation ──
    if (!ACCEPTED_IMAGE_TYPES.has(file.type)) {
      toast.error("Please select a JPEG, PNG, WebP, or GIF image.");
      if (fileRef.current) fileRef.current.value = "";
      return;
    }
    if (file.size > MAX_IMAGE_SIZE_BYTES) {
      toast.error(`Image must be smaller than ${MAX_IMAGE_SIZE_MB} MB.`);
      if (fileRef.current) fileRef.current.value = "";
      return;
    }

    setUploading(true);
    try {
      const apiUrl = getApiBaseUrl();
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch(`${apiUrl}/upload/image?target=member`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${getAccessToken() ?? ""}`,
        },
        body: formData,
      });
      if (!res.ok) throw new Error("Upload failed");
      const json = (await res.json()) as { url: string };
      setImageUrl(json.url);
      dirtyRef.current = true;
    } catch (err) {
      toast.error("Image upload failed. Please try again.");
      console.error(err);
    } finally {
      setUploading(false);
      // Reset so the same file can be re-selected after a failure
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!nick.trim() || nick.trim().length < 3) {
      toast.error("Display name must be at least 3 characters.");
      return;
    }

    // Optimistic: update session before the round-trip so the header
    // avatar and nick refresh instantly.
    const previousSession = getSessionMember();
    updateSessionMember({
      memberNick: nick.trim(),
      memberFullName: fullName.trim() || null,
      memberImage: imageUrl || null,
    });

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
      dirtyRef.current = false;
      toast.success("Profile updated.");
    } catch (err) {
      // Revert optimistic session update on failure
      if (previousSession) {
        updateSessionMember({
          memberNick: previousSession.memberNick,
          memberFullName: previousSession.memberFullName ?? null,
          memberImage: previousSession.memberImage ?? null,
        });
      }
      toast.error(getErrorMessage(err));
    }
  };

  if (!sessionMember) return null;

  const memberType = member?.memberType ?? sessionMember.memberType;
  const memberNick = member?.memberNick ?? sessionMember.memberNick;
  const initials = memberNick.slice(0, 2).toUpperCase();
  const avatarBg = AVATAR_BG[memberType] ?? "bg-slate-500";
  const tier = member?.subscriptionTier ?? "FREE";

  return (
    <main className="mx-auto max-w-2xl">
      {/* ── Profile header ────────────────────────────────────────────────── */}
      <div className="pb-6">
        <div className="flex items-start gap-5">
          {/* Avatar with upload overlay */}
          <div
            className="group relative flex-shrink-0 cursor-pointer"
            onClick={() => fileRef.current?.click()}
          >
            <div
              className={`h-20 w-20 overflow-hidden rounded-full ${avatarBg} flex items-center justify-center text-2xl font-semibold text-white`}
            >
              {imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={resolveMediaUrl(imageUrl)}
                  alt={initials}
                  className="h-full w-full object-cover"
                />
              ) : (
                <span>{initials}</span>
              )}
            </div>
            <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/40 opacity-0 transition group-hover:opacity-100">
              {uploading ? (
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
              ) : (
                <Camera size={16} className="text-white" />
              )}
            </div>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleImageChange}
            />
          </div>

          {/* Identity */}
          <div className="min-w-0 flex-1">
            <h1 className="text-2xl font-bold text-slate-900">{memberNick}</h1>
            {member?.memberFullName && (
              <p className="text-base text-slate-500">
                {member.memberFullName}
              </p>
            )}

            {/* Meta row */}
            <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-slate-400">
              <span className="capitalize">
                {memberType.replace("_", " ").toLowerCase()}
              </span>
              <span>·</span>
              <span className="flex items-center gap-1">
                <Crown size={10} />
                {TIER_LABEL[tier] ?? tier}
              </span>
              {member && member.memberRank > 0 && (
                <>
                  <span>·</span>
                  <span className="flex items-center gap-1">
                    <Star size={10} className="fill-amber-400 text-amber-400" />
                    {member.memberRank.toFixed(1)}
                  </span>
                </>
              )}
              {member?.memberAddress && (
                <>
                  <span>·</span>
                  <span className="flex items-center gap-1">
                    <MapPin size={10} />
                    {member.memberAddress}
                  </span>
                </>
              )}
            </div>

            {member?.memberDesc && (
              <p className="mt-2 text-sm text-slate-600 leading-relaxed">
                {member.memberDesc}
              </p>
            )}
          </div>
        </div>

        {/* Stats row */}
        {member && (
          <div className="mt-5 flex flex-wrap gap-x-6 gap-y-3 border-t border-slate-100 pt-5">
            <div>
              <p className="text-sm font-semibold text-slate-900">
                {member.memberPoints.toLocaleString()}
              </p>
              <p className="text-xs text-slate-400">Points</p>
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-900">
                {member.memberFollowers.toLocaleString()}
              </p>
              <p className="text-xs text-slate-400">Followers</p>
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-900">
                {member.memberFollowings.toLocaleString()}
              </p>
              <p className="text-xs text-slate-400">Following</p>
            </div>
            <div className="ml-auto text-right">
              <p className="text-sm font-semibold text-slate-900">
                {new Date(member.createdAt).toLocaleDateString("en-US", {
                  month: "short",
                  year: "numeric",
                })}
              </p>
              <p className="text-xs text-slate-400">Member since</p>
            </div>
          </div>
        )}
      </div>

      {/* ── Nav ───────────────────────────────────────────────────────────── */}
      <ProfileNav />

      {/* ── Tab content ───────────────────────────────────────────────────── */}
      {/* Tabs are kept mounted (but hidden) once visited so switching back  */}
      {/* doesn't trigger a remount + refetch flash.                         */}
      <div className="mt-6">
        <div className={activeTab === "profile" ? undefined : "hidden"}>
          {error && <ErrorNotice message={getErrorMessage(error)} />}

          {loading && !member ? (
            <div className="space-y-3">
              {[1, 2, 3, 4].map((i) => (
                <div
                  key={i}
                  className="h-10 animate-pulse rounded-lg bg-slate-100"
                />
              ))}
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
                {/* Display name */}
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">
                    Display name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={nick}
                    onChange={(e) => {
                      setNick(e.target.value);
                      markDirty();
                    }}
                    minLength={3}
                    maxLength={20}
                    required
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
                  />
                </div>

                {/* Full name */}
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">
                    Full name
                  </label>
                  <input
                    type="text"
                    value={fullName}
                    onChange={(e) => {
                      setFullName(e.target.value);
                      markDirty();
                    }}
                    maxLength={80}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
                  />
                </div>

                {/* Phone — read only */}
                {member?.memberPhone && (
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-slate-700">
                      Phone
                    </label>
                    <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-500">
                      <span className="flex-1">{member.memberPhone}</span>
                      <Lock size={12} className="text-slate-300" />
                    </div>
                  </div>
                )}

                {/* Address */}
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">
                    Location
                  </label>
                  <input
                    type="text"
                    value={address}
                    onChange={(e) => {
                      setAddress(e.target.value);
                      markDirty();
                    }}
                    maxLength={200}
                    placeholder="City, District..."
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
                  />
                </div>

                {/* About me */}
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">
                    Bio
                  </label>
                  <textarea
                    value={desc}
                    onChange={(e) => {
                      setDesc(e.target.value);
                      markDirty();
                    }}
                    maxLength={300}
                    rows={3}
                    placeholder="Tell us a bit about yourself..."
                    className="w-full resize-none rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
                  />
                  <p className="mt-1 text-right text-xs text-slate-400">
                    {desc.length}/300
                  </p>
                </div>

                <div className="flex justify-end border-t border-slate-100 pt-4">
                  <button
                    type="submit"
                    disabled={saving}
                    className="rounded-lg bg-slate-900 px-5 py-2 text-sm font-medium text-white transition hover:bg-slate-700 disabled:opacity-50"
                  >
                    {saving ? "Saving..." : "Save changes"}
                  </button>
                </div>
              </form>
            )}
        </div>

        {memberType === "USER" && (
          <>
            {visitedTabs.has("reviews") && (
              <div className={activeTab === "reviews" ? undefined : "hidden"}>
                <ReviewsTab />
              </div>
            )}
            {visitedTabs.has("likes") && (
              <div className={activeTab === "likes" ? undefined : "hidden"}>
                <LikesTab />
              </div>
            )}
            {visitedTabs.has("bookings") && (
              <div className={activeTab === "bookings" ? undefined : "hidden"}>
                <BookingsTab />
              </div>
            )}
            {visitedTabs.has("subscription") && (
              <div className={activeTab === "subscription" ? undefined : "hidden"}>
                <SubscriptionTab />
              </div>
            )}
          </>
        )}
      </div>
    </main>
  );
};

ProfilePage.auth = {
  roles: ["USER", "AGENT", "ADMIN", "ADMIN_OPERATOR"],
};

export default ProfilePage;
