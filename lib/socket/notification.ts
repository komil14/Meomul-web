import { io, type Socket } from "socket.io-client";
import { env } from "@/lib/config/env";

const trimTrailingSlashes = (value: string): string =>
  value.replace(/\/+$/, "");

const resolveNotificationSocketBaseUrl = (): string => {
  const configured = trimTrailingSlashes(env.chatSocketUrl);
  if (configured) {
    return configured.endsWith("/notifications")
      ? configured.slice(0, -14)
      : configured;
  }

  const fromGraphql = trimTrailingSlashes(env.graphqlUrl).replace(
    /\/graphql$/i,
    "",
  );
  return fromGraphql;
};

export const createNotificationSocket = (token: string | null): Socket => {
  const baseUrl = resolveNotificationSocketBaseUrl();

  return io(`${baseUrl}/notifications`, {
    autoConnect: true,
    withCredentials: true,
    transports: ["websocket", "polling"],
    ...(token ? { auth: { token: `Bearer ${token}` } } : {}),
  });
};
