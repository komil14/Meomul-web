import "@/styles/globals.css";
import type { AppProps } from "next/app";
import { ApolloProvider } from "@apollo/client/react";
import { Manrope, Space_Grotesk } from "next/font/google";
import { useRouter } from "next/router";
import { useEffect, useMemo, useState } from "react";
import { SiteFrame } from "@/components/layout/site-frame";
import { ToastProvider } from "@/components/ui/toast-provider";
import { persistApolloCache } from "@/lib/apollo/cache-storage";
import { createApolloClient } from "@/lib/apollo/client";
import { resolveGuardRedirect } from "@/lib/auth/route-guard";
import { getSessionMember } from "@/lib/auth/session";
import type { NextPageWithAuth } from "@/types/page";

type AppPropsWithAuth = AppProps & {
  Component: NextPageWithAuth;
};

const manrope = Manrope({
  subsets: ["latin"],
  variable: "--font-manrope",
});

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-space-grotesk",
});

interface GuardState {
  key: string;
  ready: boolean;
}

const APOLLO_CACHE_PERSIST_INTERVAL_MS = 60_000;

export default function App({ Component, pageProps }: AppPropsWithAuth) {
  const router = useRouter();
  const [client] = useState(() => createApolloClient());

  const guestOnly = Boolean(Component.auth?.guestOnly);
  const rolesKey = useMemo(() => Component.auth?.roles?.join(",") ?? "", [Component.auth?.roles]);
  const requiresGuard = guestOnly || rolesKey.length > 0;
  const guardKey = `${router.asPath}|guest:${guestOnly}|roles:${rolesKey}`;

  const [guardState, setGuardState] = useState<GuardState>(() => ({
    key: guardKey,
    ready: !requiresGuard,
  }));

  useEffect(() => {
    if (!requiresGuard) {
      setGuardState({ key: guardKey, ready: true });
      return;
    }

    setGuardState({ key: guardKey, ready: false });

    const redirectPath = resolveGuardRedirect(Component.auth, getSessionMember(), router.asPath);

    if (redirectPath && redirectPath !== router.asPath) {
      void router.replace(redirectPath);
      return;
    }

    setGuardState({ key: guardKey, ready: true });
  }, [Component.auth, guardKey, requiresGuard, router]);

  useEffect(() => {
    let intervalId: number | null = null;

    const persistNow = (useIdleCallback: boolean) => {
      const runPersist = () => {
        persistApolloCache(client.cache);
      };

      if (
        useIdleCallback &&
        typeof window !== "undefined" &&
        "requestIdleCallback" in window &&
        typeof window.requestIdleCallback === "function"
      ) {
        window.requestIdleCallback(runPersist, { timeout: 2000 });
        return;
      }

      persistApolloCache(client.cache);
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        persistNow(false);
        if (intervalId !== null) {
          window.clearInterval(intervalId);
          intervalId = null;
        }
        return;
      }

      if (intervalId === null) {
        intervalId = window.setInterval(() => {
          if (document.visibilityState !== "visible") {
            return;
          }

          persistNow(true);
        }, APOLLO_CACHE_PERSIST_INTERVAL_MS);
      }
    };

    intervalId = window.setInterval(() => {
      if (document.visibilityState !== "visible") {
        return;
      }

      persistNow(true);
    }, APOLLO_CACHE_PERSIST_INTERVAL_MS);

    const persistImmediately = () => {
      persistNow(false);
    };

    window.addEventListener("pagehide", persistImmediately);
    window.addEventListener("beforeunload", persistImmediately);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      if (intervalId !== null) {
        window.clearInterval(intervalId);
      }
      window.removeEventListener("pagehide", persistImmediately);
      window.removeEventListener("beforeunload", persistImmediately);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [client]);

  const isGuardReady = guardState.key === guardKey && guardState.ready;
  const showGuardLoading = requiresGuard && !isGuardReady;

  return (
    <ApolloProvider client={client}>
      <ToastProvider>
        <div className={`${manrope.variable} ${spaceGrotesk.variable}`}>
          <SiteFrame>
            {showGuardLoading ? (
              <div className="flex min-h-[40vh] items-center justify-center rounded-2xl border border-slate-200 bg-white/80">
                <p className="text-sm font-medium text-slate-600">Checking access...</p>
              </div>
            ) : (
              <Component {...pageProps} />
            )}
          </SiteFrame>
        </div>
      </ToastProvider>
    </ApolloProvider>
  );
}
