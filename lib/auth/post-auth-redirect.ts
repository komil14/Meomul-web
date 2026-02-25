import { env } from "@/lib/config/env";
import type { AuthMember } from "@/types/auth";

interface RecommendationProfileResponse {
  data?: {
    getMyRecommendationProfile?: {
      hasProfile: boolean;
    };
  };
}

const ONBOARDING_REQUIRED_MEMBER_TYPE = "USER";

const ONBOARDING_PROFILE_QUERY = `
  query GetMyRecommendationProfile {
    getMyRecommendationProfile {
      hasProfile
    }
  }
`;

const isSafeInternalPath = (path: string): boolean => path.startsWith("/");

const buildOnboardingPath = (nextPath: string): string => {
  const safeNextPath = isSafeInternalPath(nextPath) ? nextPath : "/";
  return `/onboarding?next=${encodeURIComponent(safeNextPath)}`;
};

const getHasRecommendationProfile = async (accessToken: string): Promise<boolean | null> => {
  try {
    const response = await fetch(env.graphqlUrl, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        query: ONBOARDING_PROFILE_QUERY,
      }),
    });

    if (!response.ok) {
      return null;
    }

    const payload = (await response.json()) as RecommendationProfileResponse;
    const hasProfile = payload.data?.getMyRecommendationProfile?.hasProfile;
    if (typeof hasProfile !== "boolean") {
      return null;
    }
    return hasProfile;
  } catch {
    return null;
  }
};

export const resolvePostAuthRedirect = async (authMember: AuthMember, redirectTarget: string): Promise<string> => {
  const safeTarget = isSafeInternalPath(redirectTarget) ? redirectTarget : "/";

  if (authMember.memberType !== ONBOARDING_REQUIRED_MEMBER_TYPE) {
    return safeTarget;
  }

  const hasProfile = await getHasRecommendationProfile(authMember.accessToken);
  if (hasProfile === false) {
    return buildOnboardingPath(safeTarget);
  }

  return safeTarget;
};
