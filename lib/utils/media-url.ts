import { env } from "@/lib/config/env";

const trimTrailingSlashes = (value: string): string => value.replace(/\/+$/, "");

const resolveApiBaseUrl = (): string => {
  const configured = trimTrailingSlashes(env.chatSocketUrl);
  if (configured) {
    if (configured.endsWith("/room-viewers")) {
      return configured.slice(0, -13);
    }
    if (configured.endsWith("/chat")) {
      return configured.slice(0, -5);
    }
    return configured;
  }

  return trimTrailingSlashes(env.graphqlUrl).replace(/\/graphql$/i, "");
};

const API_BASE_URL = resolveApiBaseUrl();

export const resolveMediaUrl = (value?: string | null): string => {
  if (!value) {
    return "";
  }

  if (/^https?:\/\//i.test(value)) {
    return value;
  }

  const normalizedPath = value.startsWith("/") ? value : `/${value}`;
  return `${API_BASE_URL}${normalizedPath}`;
};
