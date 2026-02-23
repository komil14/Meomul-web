import { ApolloClient, HttpLink, InMemoryCache, from } from "@apollo/client";
import { CombinedGraphQLErrors } from "@apollo/client/errors";
import { SetContextLink } from "@apollo/client/link/context";
import { ErrorLink } from "@apollo/client/link/error";
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
  return new ApolloClient({
    ssrMode: typeof window === "undefined",
    cache: new InMemoryCache(),
    link: from([errorLink, authLink, httpLink]),
  });
};
