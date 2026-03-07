import { clearPersistedApolloCache } from "@/lib/apollo/cache-storage";
import { clearOnboardingCompletionCache } from "@/lib/auth/onboarding-status";
import { env } from "@/lib/config/env";
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
  _onSessionChange?.();
};

export const clearAuthSession = (): void => {
  if (!isBrowser()) {
    return;
  }

  clearPersistedApolloCache();
  clearOnboardingCompletionCache();
  window.localStorage.removeItem(ACCESS_TOKEN_KEY);
  window.localStorage.removeItem(MEMBER_KEY);
  _onSessionChange?.();
};

export const updateSessionMember = (
  patch: Partial<
    Omit<
      SessionMember,
      "_id" | "memberType" | "memberStatus" | "memberAuthType" | "memberPhone"
    >
  >,
): void => {
  if (!isBrowser()) return;
  const current = getSessionMember();
  if (!current) return;
  window.localStorage.setItem(
    MEMBER_KEY,
    JSON.stringify({ ...current, ...patch }),
  );
  _onSessionChange?.();
};

export const isAuthenticated = (): boolean => Boolean(getAccessToken());

/**
 * Decode the JWT payload (without verification) to read its `exp` claim.
 * Returns the expiry as a Unix epoch in **seconds**, or `null` if the token
 * is missing / malformed.
 */
export const getTokenExpiry = (): number | null => {
  const token = getAccessToken();
  if (!token) return null;

  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const payload = JSON.parse(atob(parts[1])) as { exp?: number };
    return typeof payload.exp === "number" ? payload.exp : null;
  } catch {
    return null;
  }
};

/**
 * Returns the number of **milliseconds** until the current JWT expires,
 * or `0` if the token is already expired / missing.
 */
export const getTokenRemainingMs = (): number => {
  const exp = getTokenExpiry();
  if (exp === null) return 0;
  return Math.max(0, exp * 1000 - Date.now());
};

/**
 * Returns `true` when the token exists but will expire within the given
 * threshold (default 5 minutes).
 */
export const isTokenExpiringSoon = (thresholdMs = 5 * 60 * 1000): boolean => {
  const remaining = getTokenRemainingMs();
  return remaining > 0 && remaining <= thresholdMs;
};

// ── Refresh token (silent) ──────────────────────────────────────────────

let _refreshInProgress: Promise<boolean> | null = null;

/**
 * Attempt a silent token refresh via the `refreshToken` GraphQL mutation.
 * The refresh token is sent automatically as an httpOnly cookie.
 *
 * On success: saves the new access token + member data to localStorage.
 * On failure: clears the session (user must re-login).
 *
 * Returns `true` if the refresh succeeded, `false` otherwise.
 * Deduplicates concurrent calls.
 */
export const silentRefreshAccessToken = (): Promise<boolean> => {
  if (_refreshInProgress) return _refreshInProgress;

  _refreshInProgress = (async () => {
    try {
      const response = await fetch(env.graphqlHttpUrl, {
        method: "POST",
        credentials: "include", // sends httpOnly cookie
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: `mutation RefreshToken { refreshToken { _id accessToken memberNick memberType memberStatus memberAuthType memberPhone memberFullName memberImage } }`,
        }),
      });

      if (!response.ok) return false;

      const json = (await response.json()) as {
        data?: { refreshToken?: AuthMember };
        errors?: unknown[];
      };
      const authMember = json?.data?.refreshToken;
      if (!authMember?.accessToken) return false;

      // Save the new access token + member data
      saveAuthSession(authMember);
      return true;
    } catch {
      return false;
    } finally {
      _refreshInProgress = null;
    }
  })();

  return _refreshInProgress;
};

/**
 * Logout: call the backend `logout` mutation to revoke the refresh token
 * cookie, then clear local session.
 */
export const logoutSession = async (): Promise<void> => {
  try {
    await fetch(env.graphqlHttpUrl, {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        ...(getAccessToken()
          ? { Authorization: `Bearer ${getAccessToken()}` }
          : {}),
      },
      body: JSON.stringify({
        query: `mutation Logout { logout { success message } }`,
      }),
    });
  } catch {
    // Best-effort — always clear local session regardless
  }
  clearAuthSession();
};
