import { ApolloClient, HttpLink, InMemoryCache, from } from "@apollo/client";
import { CombinedGraphQLErrors } from "@apollo/client/errors";
import { SetContextLink } from "@apollo/client/link/context";
import { ErrorLink } from "@apollo/client/link/error";
import { restorePersistedApolloCache } from "@/lib/apollo/cache-storage";
import { clearAuthSession, getAccessToken } from "@/lib/auth/session";
import { env } from "@/lib/config/env";

const authLink = new SetContextLink((prevContext) => {
  const token = getAccessToken();

  return {
    headers: {
      ...prevContext.headers,
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
  };
});

const errorLink = new ErrorLink(({ error }) => {
  if (CombinedGraphQLErrors.is(error)) {
    const unauthenticated = error.errors.some(
      (graphQLError) => graphQLError.extensions?.code === "UNAUTHENTICATED",
    );

    if (unauthenticated) {
      clearAuthSession();
    }
  }
});

const httpLink = new HttpLink({
  uri: env.graphqlUrl,
});

export const createApolloClient = () => {
  const cache = new InMemoryCache({
    typePolicies: {
      BookingDto: { keyFields: ["_id"] },
      ChatDto: { keyFields: ["_id"] },
      Hotel: { keyFields: ["_id"] },
      HotelDto: { keyFields: ["_id"] },
      Room: { keyFields: ["_id"] },
      RoomDto: { keyFields: ["_id"] },
      User: { keyFields: ["_id"] },
      Member: { keyFields: ["_id"] },
    },
  });
  restorePersistedApolloCache(cache);

  return new ApolloClient({
    ssrMode: typeof window === "undefined",
    queryDeduplication: true,
    assumeImmutableResults: true,
    cache,
    defaultOptions: {
      watchQuery: {
        fetchPolicy: "cache-first",
        nextFetchPolicy: "cache-first",
        returnPartialData: true,
      },
      query: {
        fetchPolicy: "cache-first",
      },
    },
    link: from([errorLink, authLink, httpLink]),
  });
};
