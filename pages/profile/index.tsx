import { useMutation, useQuery } from "@apollo/client/react";
import { useRouter } from "next/router";
import { useEffect, useMemo, useRef, useState } from "react";
import type { ChangeEvent, FormEvent } from "react";
import { ErrorNotice } from "@/components/ui/error-notice";
import { useToast } from "@/components/ui/toast-provider";
import { GET_MEMBER_QUERY, UPDATE_MEMBER_MUTATION } from "@/graphql/member.gql";
import { getSessionMember } from "@/lib/auth/session";
import { getErrorMessage } from "@/lib/utils/error";
import { Camera, Crown, Star } from "lucide-react";
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

const ROLE_COLOR: Record<string, string> = {
  USER: "bg-sky-500",
  AGENT: "bg-violet-500",
  ADMIN: "bg-rose-500",
  ADMIN_OPERATOR: "bg-rose-500",
};

const TIER_LABEL: Record<string, { label: string; color: string }> = {
  FREE: { label: "Free", color: "text-slate-500" },
  BASIC: { label: "Basic", color: "text-sky-500" },
  PREMIUM: { label: "Premium", color: "text-violet-500" },
  ELITE: { label: "Elite", color: "text-amber-500" },
};

// ─── Profile Page ─────────────────────────────────────────────────────────────

const ProfilePage: NextPageWithAuth = () => {
  const router = useRouter();
  const toast = useToast();
  const sessionMember = useMemo(() => getSessionMember(), []);
  const fileRef = useRef<HTMLInputElement>(null);

  const [uploading, setUploading] = useState(false);
  const [nick, setNick] = useState("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [desc, setDesc] = useState("");
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [hasLoaded, setHasLoaded] = useState(false);

  useEffect(() => {
    if (!sessionMember) {
      void router.replace("/auth/login");
    }
  }, [sessionMember, router]);

  const { data, loading, error } = useQuery<GetMemberData>(GET_MEMBER_QUERY, {
    skip: !sessionMember,
    fetchPolicy: "cache-and-network",
    nextFetchPolicy: "cache-and-network",
  });

  const [updateMember, { loading: saving }] = useMutation(UPDATE_MEMBER_MUTATION);

  const member = data?.getMember;

  // Pre-fill form when data arrives
  useEffect(() => {
    if (member && !hasLoaded) {
      setNick(member.memberNick ?? "");
      setFullName(member.memberFullName ?? "");
      setPhone(member.memberPhone ?? "");
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
        headers: { Authorization: `Bearer ${sessionMember ? (typeof window !== "undefined" ? localStorage.getItem("accessToken") : "") : ""}` },
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

  const bg = ROLE_COLOR[member?.memberType ?? sessionMember.memberType] ?? "bg-slate-500";
  const initials = (member?.memberNick ?? sessionMember.memberNick).slice(0, 2).toUpperCase();
  const tier = member?.subscriptionTier ?? "FREE";
  const tierCfg = TIER_LABEL[tier] ?? TIER_LABEL.FREE;

  return (
    <main className="mx-auto max-w-xl space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-slate-900">Profile</h1>
        <p className="mt-0.5 text-sm text-slate-500">Manage your account details.</p>
      </div>

      {error && <ErrorNotice message={getErrorMessage(error)} />}

      {loading && !member ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-12 animate-pulse rounded-xl bg-slate-100" />
          ))}
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Avatar */}
          <div className="flex items-center gap-5">
            <div className="relative flex-shrink-0">
              <div className={`flex h-20 w-20 items-center justify-center overflow-hidden rounded-full ${bg} text-xl font-bold text-white`}>
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
                className="absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full border-2 border-white bg-slate-800 text-white shadow transition hover:bg-slate-700 disabled:opacity-60"
                aria-label="Change avatar"
              >
                {uploading ? (
                  <div className="h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent" />
                ) : (
                  <Camera size={13} />
                )}
              </button>
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleImageChange} />
            </div>
            <div>
              <p className="font-semibold text-slate-900">{member?.memberNick ?? sessionMember.memberNick}</p>
              <p className="text-xs capitalize text-slate-400">{(member?.memberType ?? sessionMember.memberType).replace("_", " ").toLowerCase()}</p>
              <div className={`mt-1 flex items-center gap-1 text-xs font-medium ${tierCfg.color}`}>
                <Crown size={11} />
                {tierCfg.label} plan
              </div>
            </div>
          </div>

          {/* Stats row */}
          {member && (
            <div className="grid grid-cols-3 gap-2">
              {[
                { label: "Points", value: member.memberPoints.toLocaleString() },
                { label: "Followers", value: member.memberFollowers.toLocaleString() },
                { label: "Following", value: member.memberFollowings.toLocaleString() },
              ].map(({ label, value }) => (
                <div key={label} className="rounded-xl bg-slate-50 px-3 py-3 text-center">
                  <p className="text-base font-bold text-slate-900">{value}</p>
                  <p className="text-[11px] text-slate-400">{label}</p>
                </div>
              ))}
            </div>
          )}

          {/* Form fields */}
          <div className="space-y-4 rounded-2xl border border-slate-100 bg-white p-5">
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

          {/* Rank badge */}
          {member && member.memberRank > 0 && (
            <div className="flex items-center gap-2 rounded-xl bg-amber-50 px-4 py-3">
              <Star size={15} className="text-amber-400 fill-amber-400" />
              <p className="text-sm font-medium text-amber-700">
                Your rank: <span className="font-bold">{member.memberRank.toFixed(1)}</span>
              </p>
            </div>
          )}

          <button
            type="submit"
            disabled={saving}
            className="w-full rounded-xl bg-slate-900 py-3 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:opacity-60"
          >
            {saving ? "Saving..." : "Save changes"}
          </button>
        </form>
      )}
    </main>
  );
};

ProfilePage.auth = {
  roles: ["USER", "AGENT", "ADMIN", "ADMIN_OPERATOR"],
};

export default ProfilePage;
