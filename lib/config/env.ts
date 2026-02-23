const DEFAULT_GRAPHQL_URL = "http://localhost:3001/graphql";
const DEFAULT_CHAT_SOCKET_URL = "http://localhost:3001";

export const env = {
  graphqlUrl: process.env.NEXT_PUBLIC_GRAPHQL_URL ?? DEFAULT_GRAPHQL_URL,
  chatSocketUrl: process.env.NEXT_PUBLIC_CHAT_SOCKET_URL ?? DEFAULT_CHAT_SOCKET_URL,
} as const;
