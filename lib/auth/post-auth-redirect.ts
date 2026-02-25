import type { AuthMember } from "@/types/auth";
import { buildOnboardingPath, resolveHasRecommendationProfile } from "@/lib/auth/onboarding-status";

const ONBOARDING_REQUIRED_MEMBER_TYPE = "USER";

const isSafeInternalPath = (path: string): boolean => path.startsWith("/");

export const resolvePostAuthRedirect = async (authMember: AuthMember, redirectTarget: string): Promise<string> => {
  const safeTarget = isSafeInternalPath(redirectTarget) ? redirectTarget : "/";

  if (authMember.memberType !== ONBOARDING_REQUIRED_MEMBER_TYPE) {
    return safeTarget;
  }

  const hasProfile = await resolveHasRecommendationProfile(authMember._id, authMember.accessToken, {
    forceRefresh: true,
  });
  if (hasProfile === false) {
    return buildOnboardingPath(safeTarget);
  }

  return safeTarget;
};
