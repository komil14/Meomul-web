const isProduction =
  typeof process !== "undefined" && process.env.NODE_ENV === "production";
const isDev =
  typeof process !== "undefined" && process.env.NODE_ENV === "development";

function requireEnv(name: string, fallback: string): string {
  const value = process.env[name];
  if (value) return value;

  if (isProduction && typeof window === "undefined") {
    // Server-side in production: hard-fail so misconfigured deploys are caught immediately
    throw new Error(
      `[env] FATAL: ${name} is not set. All NEXT_PUBLIC_* variables must be configured for production. Aborting.`,
    );
  }

  if (!isDev && typeof window === "undefined") {
    console.warn(
      `[env] ${name} is not set — falling back to "${fallback}". Set it in .env.local for production.`,
    );
  }
  return fallback;
}

export const env = {
  graphqlUrl: requireEnv(
    "NEXT_PUBLIC_GRAPHQL_URL",
    "http://localhost:3001/graphql",
  ),
  chatSocketUrl: requireEnv(
    "NEXT_PUBLIC_CHAT_SOCKET_URL",
    "http://localhost:3001",
  ),
  apiUrl: requireEnv("NEXT_PUBLIC_API_URL", "http://localhost:3001"),
} as const;

/**
 * Resolve an image path to a full URL.
 * - If the path is already an absolute URL (http/https), return it as-is.
 * - Otherwise, prefix it with the API base URL.
 */
export function resolveImageUrl(path: string): string {
  if (path.startsWith("http://") || path.startsWith("https://")) {
    return path;
  }
  const base = env.apiUrl;
  const cleanPath = path.startsWith("/") ? path : `/${path}`;
  return `${base}${cleanPath}`;
}
