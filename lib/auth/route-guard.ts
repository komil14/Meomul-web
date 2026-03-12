import type { SessionMember } from "@/types/auth";
import { resolveOnboardingRedirect } from "@/lib/auth/onboarding-status";
import {
  clearAuthSession,
  getAccessToken,
  getSessionMember,
  getTokenRemainingMs,
  silentRefreshAccessToken,
} from "@/lib/auth/session";
import type { AuthRequirement } from "@/types/page";

const DASHBOARD_PATH = "/dashboard";
const FORBIDDEN_PATH = "/403";

const buildLoginPath = (nextPath: string): string => {
  const encodedPath = encodeURIComponent(nextPath);
  return `/auth/login?next=${encodedPath}`;
};

export const resolveGuardRedirect = async (
  auth: AuthRequirement | undefined,
  member: SessionMember | null,
  currentPath: string,
): Promise<string | null> => {
  if (member && getTokenRemainingMs() === 0) {
    const refreshed = await silentRefreshAccessToken();

    if (refreshed) {
      member = getSessionMember();
    } else {
      clearAuthSession();
      member = null;
    }
  }

  if (member) {
    const onboardingRedirect = await resolveOnboardingRedirect(member, currentPath, getAccessToken());
    if (onboardingRedirect) {
      return onboardingRedirect;
    }
  }

  if (!auth) {
    return null;
  }

  if (auth.guestOnly && member) {
    return DASHBOARD_PATH;
  }

  if (!auth.roles || auth.roles.length === 0) {
    return null;
  }

  if (!member) {
    return buildLoginPath(currentPath);
  }

  if (!auth.roles.includes(member.memberType)) {
    return FORBIDDEN_PATH;
  }

  return null;
};
