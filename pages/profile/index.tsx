import { useQuery } from "@apollo/client/react";
import { useRouter } from "next/router";
import { useEffect, useMemo, useState } from "react";
import { ProfileSidebar } from "@/components/profile/profile-sidebar";
import { EditProfileModal } from "@/components/profile/edit-profile-modal";
import { ProfileNav } from "@/components/profile/profile-nav";
import { ReviewsTab } from "@/components/profile/reviews-tab";
import { LikesTab } from "@/components/profile/likes-tab";
import { SubscriptionTab } from "@/components/profile/subscription-tab";
import { BookingsTab } from "@/components/profile/bookings-tab";
import { ErrorNotice } from "@/components/ui/error-notice";
import { GET_MEMBER_QUERY } from "@/graphql/member.gql";
import { getSessionMember, updateSessionMember } from "@/lib/auth/session";
import { getErrorMessage } from "@/lib/utils/error";
import { Calendar, FileText, MapPin, Phone } from "lucide-react";
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

// ─── Profile overview (read-only) ─────────────────────────────────────────────

function ProfileOverview({ member }: { member: MemberDto }) {
  return (
    <div className="space-y-4 motion-fade-up motion-delay-1">
      {/* About card */}
      <div className="rounded-2xl border border-slate-100/80 bg-white p-5 shadow-sm">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
          <FileText size={15} className="text-slate-400" />
          About
        </h3>
        <p className="mt-3 text-sm leading-relaxed text-slate-600">
          {member.memberDesc ||
            "No bio yet — edit your profile to tell others about yourself."}
        </p>
      </div>

      {/* Details card */}
      <div className="rounded-2xl border border-slate-100/80 bg-white p-5 shadow-sm">
        <h3 className="mb-4 text-sm font-semibold text-slate-900">Details</h3>
        <dl className="space-y-3.5">
          {member.memberAddress && (
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-slate-50">
                <MapPin size={14} className="text-slate-400" />
              </div>
              <div>
                <dt className="text-[11px] font-medium uppercase tracking-wide text-muted">
                  Location
                </dt>
                <dd className="text-sm text-slate-700">
                  {member.memberAddress}
                </dd>
              </div>
            </div>
          )}
          {member.memberPhone && (
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-slate-50">
                <Phone size={14} className="text-slate-400" />
              </div>
              <div>
                <dt className="text-[11px] font-medium uppercase tracking-wide text-muted">
                  Phone
                </dt>
                <dd className="text-sm text-slate-700">{member.memberPhone}</dd>
              </div>
            </div>
          )}
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-slate-50">
              <Calendar size={14} className="text-slate-400" />
            </div>
            <div>
              <dt className="text-[11px] font-medium uppercase tracking-wide text-muted">
                Member since
              </dt>
              <dd className="text-sm text-slate-700">
                {new Date(member.createdAt).toLocaleDateString("en-US", {
                  month: "long",
                  day: "numeric",
                  year: "numeric",
                })}
              </dd>
            </div>
          </div>
        </dl>
      </div>
    </div>
  );
}

function ProfileOverviewSkeleton() {
  return (
    <div className="space-y-4">
      {[1, 2].map((i) => (
        <div
          key={i}
          className="rounded-2xl border border-slate-100/80 bg-white p-5"
        >
          <div className="h-4 w-20 animate-pulse rounded-full bg-slate-100" />
          <div className="mt-4 space-y-2.5">
            <div className="h-3.5 w-3/4 animate-pulse rounded-full bg-slate-100" />
            <div className="h-3.5 w-1/2 animate-pulse rounded-full bg-slate-50" />
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

const ProfilePage: NextPageWithAuth = () => {
  const router = useRouter();
  const sessionMember = useMemo(() => getSessionMember(), []);
  const activeTab = (router.query.tab as string) ?? "profile";

  const [showEditModal, setShowEditModal] = useState(false);

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

  useEffect(() => {
    if (!sessionMember) void router.replace("/auth/login");
  }, [sessionMember, router]);

  const { data, loading, error } = useQuery<GetMemberData>(GET_MEMBER_QUERY, {
    skip: !sessionMember,
    fetchPolicy: "network-only",
    nextFetchPolicy: "cache-and-network",
  });

  const member = data?.getMember;

  // Keep session storage in sync so the site-frame avatar also updates
  useEffect(() => {
    if (member) {
      const session = getSessionMember();
      if (
        session &&
        (member.memberImage ?? null) !== (session.memberImage ?? null)
      ) {
        updateSessionMember({ memberImage: member.memberImage ?? null });
      }
    }
  }, [member]);

  if (!sessionMember) return null;

  const memberType = member?.memberType ?? sessionMember.memberType;

  return (
    <main className="mx-auto max-w-5xl">
      {/* ── Gradient banner ─────────────────────────────────────────────── */}
      <div className="motion-fade-up -mx-3 h-36 bg-gradient-to-br from-teal-700 via-teal-600/80 to-cyan-500/60 sm:-mx-6 sm:h-44 sm:rounded-b-[2rem]" />

      {/* ── Two-column layout ───────────────────────────────────────────── */}
      <div className="-mt-16 grid grid-cols-1 gap-6 px-1 sm:gap-8 sm:px-0 md:grid-cols-[280px_1fr]">
        {/* Sidebar */}
        <ProfileSidebar
          member={member}
          loading={loading}
          onEdit={() => setShowEditModal(true)}
        />

        {/* Content area — push below the banner on desktop */}
        <div className="min-w-0 space-y-5 md:pt-20">
          {/* Mobile horizontal nav (hidden on md+) */}
          <ProfileNav />

          {/* Profile overview tab */}
          <div className={activeTab === "profile" ? undefined : "hidden"}>
            {error && <ErrorNotice message={getErrorMessage(error)} />}
            {loading && !member ? (
              <ProfileOverviewSkeleton />
            ) : member ? (
              <ProfileOverview member={member} />
            ) : null}
          </div>

          {/* Tab section headers — shows which tab is active */}
          {activeTab !== "profile" && (
            <div className="motion-fade-up">
              <h2 className="font-display text-lg font-bold text-slate-900">
                {activeTab === "reviews" && "My Reviews"}
                {activeTab === "likes" && "Saved Hotels"}
                {activeTab === "bookings" && "My Bookings"}
                {activeTab === "subscription" && "Subscription"}
              </h2>
            </div>
          )}

          {/* User-specific tabs */}
          {memberType === "USER" && (
            <>
              {visitedTabs.has("reviews") && (
                <div
                  className={
                    activeTab === "reviews" ? "motion-fade-up" : "hidden"
                  }
                >
                  <ReviewsTab />
                </div>
              )}
              {visitedTabs.has("likes") && (
                <div
                  className={
                    activeTab === "likes" ? "motion-fade-up" : "hidden"
                  }
                >
                  <LikesTab />
                </div>
              )}
              {visitedTabs.has("bookings") && (
                <div
                  className={
                    activeTab === "bookings" ? "motion-fade-up" : "hidden"
                  }
                >
                  <BookingsTab />
                </div>
              )}
              {visitedTabs.has("subscription") && (
                <div
                  className={
                    activeTab === "subscription" ? "motion-fade-up" : "hidden"
                  }
                >
                  <SubscriptionTab />
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* ── Edit profile modal ────────────────────────────────────────── */}
      {member && (
        <EditProfileModal
          isOpen={showEditModal}
          onClose={() => setShowEditModal(false)}
          member={member}
        />
      )}
    </main>
  );
};

ProfilePage.auth = {
  roles: ["USER", "AGENT", "ADMIN", "ADMIN_OPERATOR"],
};

export default ProfilePage;
