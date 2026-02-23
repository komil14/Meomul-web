import type { SessionMember } from "@/types/auth";
import type { AuthRequirement } from "@/types/page";

const DASHBOARD_PATH = "/dashboard";
const FORBIDDEN_PATH = "/403";

const buildLoginPath = (nextPath: string): string => {
  const encodedPath = encodeURIComponent(nextPath);
  return `/auth/login?next=${encodedPath}`;
};

export const resolveGuardRedirect = (
  auth: AuthRequirement | undefined,
  member: SessionMember | null,
  currentPath: string,
): string | null => {
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
