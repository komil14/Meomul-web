const DEFAULT_GRAPHQL_URL = "http://localhost:3001/graphql";

export const env = {
  graphqlUrl: process.env.NEXT_PUBLIC_GRAPHQL_URL ?? DEFAULT_GRAPHQL_URL,
} as const;
