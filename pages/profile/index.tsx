import { useQuery } from "@apollo/client/react";
import { useRouter } from "next/router";
import { useEffect, useMemo, useState } from "react";
import { ProfileHeader } from "@/components/profile/profile-sidebar";
import { EditProfileModal } from "@/components/profile/edit-profile-modal";
import { ProfileNav } from "@/components/profile/profile-nav";
import { ReviewsTab } from "@/components/profile/reviews-tab";
import { LikesTab } from "@/components/profile/likes-tab";
import { SubscriptionTab } from "@/components/profile/subscription-tab";
import { BookingsTab } from "@/components/profile/bookings-tab";
import { ErrorNotice } from "@/components/ui/error-notice";
import { GET_MEMBER_QUERY } from "@/graphql/member.gql";
import { getSessionMember, updateSessionMember } from "@/lib/auth/session";
import { useI18n } from "@/lib/i18n/provider";
import {
  formatProfileDate,
  getProfileCopy,
} from "@/lib/profile/profile-i18n";
import { getErrorMessage } from "@/lib/utils/error";
import { Calendar, MapPin, Phone } from "lucide-react";
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

// ─── Profile overview ─────────────────────────────────────────────────────────

function ProfileOverview({ member }: { member: MemberDto }) {
  const { locale } = useI18n();
  const copy = getProfileCopy(locale);
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {/* About */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 sm:col-span-2">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
          {copy.about}
        </p>
        <p className="mt-2.5 text-sm leading-relaxed text-slate-600">
          {member.memberDesc ||
            copy.noBio}
        </p>
      </div>

      {/* Detail cards */}
      {member.memberAddress && (
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-50">
              <MapPin size={16} className="text-slate-400" />
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">
                {copy.location}
              </p>
              <p className="text-sm font-medium text-slate-700">
                {member.memberAddress}
              </p>
            </div>
          </div>
        </div>
      )}

      {member.memberPhone && (
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-50">
              <Phone size={16} className="text-slate-400" />
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">
                {copy.phone}
              </p>
              <p className="text-sm font-medium text-slate-700">
                {member.memberPhone}
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="rounded-2xl border border-slate-200 bg-white p-5">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-50">
            <Calendar size={16} className="text-slate-400" />
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">
              {copy.joined}
            </p>
            <p className="text-sm font-medium text-slate-700">
              {formatProfileDate(locale, member.createdAt)}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function ProfileOverviewSkeleton() {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="rounded-2xl border border-slate-200 bg-white p-5 sm:col-span-2">
        <div className="h-3 w-16 animate-pulse rounded-full bg-slate-100" />
        <div className="mt-3 space-y-2">
          <div className="h-3.5 w-3/4 animate-pulse rounded-full bg-slate-100" />
          <div className="h-3.5 w-1/2 animate-pulse rounded-full bg-slate-50" />
        </div>
      </div>
      {[1, 2].map((i) => (
        <div
          key={i}
          className="rounded-2xl border border-slate-200 bg-white p-5"
        >
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 animate-pulse rounded-lg bg-slate-50" />
            <div className="space-y-1.5">
              <div className="h-2.5 w-12 animate-pulse rounded-full bg-slate-100" />
              <div className="h-3.5 w-24 animate-pulse rounded-full bg-slate-50" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

const ProfilePage: NextPageWithAuth = () => {
  const { locale } = useI18n();
  const copy = getProfileCopy(locale);
  const router = useRouter();
  const sessionMember = useMemo(() => getSessionMember(), []);
  const activeTab = (router.query.tab as string) ?? "profile";

  const [showEditModal, setShowEditModal] = useState(false);

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
    <main className="mx-auto w-full max-w-5xl space-y-6">
      {/* Eyebrow */}
      <div className="motion-fade-up">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
          {copy.profile}
        </p>
      </div>

      {/* Profile header card */}
      <div className="motion-fade-up motion-delay-1">
        <ProfileHeader
          member={member}
          loading={loading}
          onEdit={() => setShowEditModal(true)}
        />
      </div>

      {/* Tab navigation */}
      <div className="motion-fade-up motion-delay-2">
        <ProfileNav />
      </div>

      {/* Tab content */}
      <div
        className={
          activeTab === "profile" ? "motion-fade-up motion-delay-3" : "hidden"
        }
      >
        {error && <ErrorNotice message={getErrorMessage(error)} />}
        {loading && !member ? (
          <ProfileOverviewSkeleton />
        ) : member ? (
          <ProfileOverview member={member} />
        ) : null}
      </div>

      {(memberType === "USER" || memberType === "AGENT") && (
        <>
          {visitedTabs.has("reviews") && (
            <div
              className={activeTab === "reviews" ? "motion-fade-up" : "hidden"}
            >
              <ReviewsTab />
            </div>
          )}
          {visitedTabs.has("likes") && (
            <div
              className={activeTab === "likes" ? "motion-fade-up" : "hidden"}
            >
              <LikesTab />
            </div>
          )}
          {visitedTabs.has("bookings") && (
            <div
              className={activeTab === "bookings" ? "motion-fade-up" : "hidden"}
            >
              <BookingsTab />
            </div>
          )}
        </>
      )}

      {memberType === "USER" && (
        <>
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
