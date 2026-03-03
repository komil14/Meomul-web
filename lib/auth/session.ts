import { clearPersistedApolloCache } from "@/lib/apollo/cache-storage";
import { clearOnboardingCompletionCache } from "@/lib/auth/onboarding-status";
import type { AuthMember, SessionMember } from "@/types/auth";

const ACCESS_TOKEN_KEY = "meomul.access_token";
const MEMBER_KEY = "meomul.member";

const isBrowser = (): boolean => typeof window !== "undefined";

// Module-level subscriber — site-frame registers here to get instant updates
// when the profile page saves changes without a route change.
let _onSessionChange: (() => void) | null = null;

export const registerSessionChangeListener = (cb: () => void): void => {
  _onSessionChange = cb;
};

export const unregisterSessionChangeListener = (): void => {
  _onSessionChange = null;
};

export const getAccessToken = (): string | null => {
  if (!isBrowser()) {
    return null;
  }

  return window.localStorage.getItem(ACCESS_TOKEN_KEY);
};

export const getSessionMember = (): SessionMember | null => {
  if (!isBrowser()) {
    return null;
  }

  const raw = window.localStorage.getItem(MEMBER_KEY);
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as SessionMember;
  } catch {
    window.localStorage.removeItem(MEMBER_KEY);
    return null;
  }
};

export const saveAuthSession = (authMember: AuthMember): void => {
  if (!isBrowser()) {
    return;
  }

  clearPersistedApolloCache();
  clearOnboardingCompletionCache();
  const { accessToken, ...member } = authMember;
  window.localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
  window.localStorage.setItem(MEMBER_KEY, JSON.stringify(member));
};

export const clearAuthSession = (): void => {
  if (!isBrowser()) {
    return;
  }

  clearPersistedApolloCache();
  clearOnboardingCompletionCache();
  window.localStorage.removeItem(ACCESS_TOKEN_KEY);
  window.localStorage.removeItem(MEMBER_KEY);
};

export const updateSessionMember = (patch: Partial<Omit<SessionMember, "_id" | "memberType" | "memberStatus" | "memberAuthType" | "memberPhone">>): void => {
  if (!isBrowser()) return;
  const current = getSessionMember();
  if (!current) return;
  window.localStorage.setItem(MEMBER_KEY, JSON.stringify({ ...current, ...patch }));
  _onSessionChange?.();
};

export const isAuthenticated = (): boolean => Boolean(getAccessToken());
