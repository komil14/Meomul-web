import { io, type Socket } from "socket.io-client";
import { env } from "@/lib/config/env";

const trimTrailingSlashes = (value: string): string => value.replace(/\/+$/, "");

const resolveChatSocketBaseUrl = (): string => {
  const configured = trimTrailingSlashes(env.chatSocketUrl);
  if (configured) {
    return configured.endsWith("/chat") ? configured.slice(0, -5) : configured;
  }

  const fromGraphql = trimTrailingSlashes(env.graphqlUrl).replace(/\/graphql$/i, "");
  return fromGraphql;
};

export const createChatSocket = (token: string | null): Socket => {
  const baseUrl = resolveChatSocketBaseUrl();

  return io(`${baseUrl}/chat`, {
    autoConnect: true,
    withCredentials: true,
    transports: ["websocket", "polling"],
    ...(token ? { auth: { token: `Bearer ${token}` } } : {}),
  });
};
