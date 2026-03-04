const DEFAULT_GRAPHQL_URL = "http://localhost:3001/graphql";
const DEFAULT_CHAT_SOCKET_URL = "http://localhost:3001";
const DEFAULT_API_URL = "http://localhost:3001";

export const env = {
  graphqlUrl: process.env.NEXT_PUBLIC_GRAPHQL_URL ?? DEFAULT_GRAPHQL_URL,
  chatSocketUrl:
    process.env.NEXT_PUBLIC_CHAT_SOCKET_URL ?? DEFAULT_CHAT_SOCKET_URL,
  apiUrl: process.env.NEXT_PUBLIC_API_URL ?? DEFAULT_API_URL,
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
