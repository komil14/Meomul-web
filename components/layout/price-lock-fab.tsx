import { useMutation, useQuery } from "@apollo/client/react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { CANCEL_PRICE_LOCK_MUTATION, GET_MY_PRICE_LOCK_QUERY, GET_MY_PRICE_LOCKS_QUERY } from "@/graphql/hotel.gql";
import { getSessionMember } from "@/lib/auth/session";
import { usePageVisible } from "@/lib/hooks/use-page-visible";
import { getErrorMessage } from "@/lib/utils/error";
import type {
  CancelPriceLockMutationData,
  CancelPriceLockMutationVars,
  GetMyPriceLocksQueryData,
  PriceLockDto,
} from "@/types/hotel";

const canUsePriceLock = (memberType: string | undefined): boolean =>
  memberType === "USER" || memberType === "AGENT" || memberType === "ADMIN";

const getRemainingSeconds = (expiresAt: string, nowMs: number): number => Math.max(0, Math.floor((new Date(expiresAt).getTime() - nowMs) / 1000));
const ACTIVE_LOCK_POLL_INTERVAL_MS = 60000;
const IDLE_LOCK_POLL_INTERVAL_MS = 180000;

const formatCountdown = (seconds: number): string => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
};

export function PriceLockFab() {
  const [isHydrated, setIsHydrated] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [nowMs, setNowMs] = useState(0);
  const [actionError, setActionError] = useState<string | null>(null);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const isPageVisible = usePageVisible();
  const member = useMemo(() => (isHydrated ? getSessionMember() : null), [isHydrated]);
  const canUse = canUsePriceLock(member?.memberType);

  const { data, loading, startPolling, stopPolling, refetch } = useQuery<GetMyPriceLocksQueryData>(GET_MY_PRICE_LOCKS_QUERY, {
    skip: !isHydrated || !canUse || !isPageVisible,
    fetchPolicy: "cache-first",
    nextFetchPolicy: "cache-first",
  });
  const [cancelPriceLockMutation] = useMutation<CancelPriceLockMutationData, CancelPriceLockMutationVars>(CANCEL_PRICE_LOCK_MUTATION);

  useEffect(() => {
    setIsHydrated(true);
    setNowMs(Date.now());
  }, []);

  useEffect(() => {
    if (!isHydrated || !canUse || !isPageVisible) {
      return;
    }

    void refetch();
  }, [canUse, isHydrated, isPageVisible, refetch]);

  const hasUnexpiredLocks = useMemo(() => {
    const locks = data?.getMyPriceLocks ?? [];
    const currentNowMs = Date.now();
    return locks.some((lock) => getRemainingSeconds(lock.expiresAt, currentNowMs) > 0);
  }, [data?.getMyPriceLocks]);

  useEffect(() => {
    if (!isHydrated || !canUse || !isPageVisible) {
      stopPolling();
      return;
    }

    const intervalMs = hasUnexpiredLocks ? ACTIVE_LOCK_POLL_INTERVAL_MS : IDLE_LOCK_POLL_INTERVAL_MS;
    startPolling(intervalMs);
    return () => stopPolling();
  }, [canUse, hasUnexpiredLocks, isHydrated, isPageVisible, startPolling, stopPolling]);

  useEffect(() => {
    if (!isHydrated || !canUse || !isPageVisible) {
      return;
    }
    if (!hasUnexpiredLocks) {
      setNowMs(Date.now());
      return;
    }

    const timer = window.setInterval(() => {
      setNowMs(Date.now());
    }, 1000);
    return () => window.clearInterval(timer);
  }, [canUse, hasUnexpiredLocks, isHydrated, isPageVisible]);

  const activeLocks = useMemo(() => {
    const locks = data?.getMyPriceLocks ?? [];
    return locks
      .filter((lock) => getRemainingSeconds(lock.expiresAt, nowMs) > 0)
      .sort((a, b) => new Date(a.expiresAt).getTime() - new Date(b.expiresAt).getTime());
  }, [data?.getMyPriceLocks, nowMs]);

  const nearestLock = activeLocks[0];
  const nearestRemaining = nearestLock ? getRemainingSeconds(nearestLock.expiresAt, nowMs) : 0;
  const isAlert = nearestRemaining > 0 && nearestRemaining <= 600;
  const panelBottomClass = "bottom-40";
  const buttonBottomClass = "bottom-24";

  const handleCancel = async (lock: PriceLockDto): Promise<void> => {
    setActionError(null);
    setCancellingId(lock._id);
    try {
      await cancelPriceLockMutation({
        variables: { priceLockId: lock._id },
        refetchQueries: [
          { query: GET_MY_PRICE_LOCKS_QUERY },
          { query: GET_MY_PRICE_LOCK_QUERY, variables: { roomId: lock.roomId } },
        ],
        awaitRefetchQueries: true,
      });
    } catch (error) {
      setActionError(getErrorMessage(error));
    } finally {
      setCancellingId(null);
    }
  };

  if (!isHydrated || !canUse) {
    return null;
  }

  return (
    <>
      {isOpen ? (
        <section className={`fixed right-5 z-50 w-80 rounded-2xl border border-slate-200 bg-white p-3 shadow-2xl ${panelBottomClass}`}>
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Active Price Locks</p>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="rounded-md border border-slate-300 px-2 py-1 text-xs font-semibold text-slate-700 transition hover:border-slate-500"
            >
              Close
            </button>
          </div>
          {nearestLock ? (
            <p className={`mt-2 text-sm font-semibold ${isAlert ? "text-rose-600" : "text-slate-900"}`}>
              Nearest expires in {formatCountdown(nearestRemaining)}
            </p>
          ) : (
            <p className="mt-2 text-xs text-slate-500">{loading ? "Checking active locks..." : "No active locks right now."}</p>
          )}
          {actionError ? <p className="mt-2 text-xs font-medium text-rose-600">{actionError}</p> : null}
          <div className="mt-3 max-h-60 space-y-2 overflow-y-auto">
            {activeLocks.map((lock) => {
              const remaining = getRemainingSeconds(lock.expiresAt, nowMs);
              return (
                <article key={lock._id} className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">₩ {lock.lockedPrice.toLocaleString()}</p>
                      <p className="text-xs text-slate-600">Room {lock.roomId}</p>
                      <p className={`text-xs font-semibold ${remaining <= 600 ? "text-rose-600" : "text-slate-700"}`}>{formatCountdown(remaining)}</p>
                    </div>
                    <div className="grid gap-1.5">
                      <Link
                        href={`/rooms/${lock.roomId}`}
                        className="inline-flex items-center justify-center rounded-md border border-slate-300 px-2 py-1 text-xs font-semibold text-slate-700 transition hover:border-slate-500"
                      >
                        Open
                      </Link>
                      <button
                        type="button"
                        onClick={() => void handleCancel(lock)}
                        disabled={cancellingId === lock._id}
                        className="inline-flex items-center justify-center rounded-md border border-rose-300 px-2 py-1 text-xs font-semibold text-rose-700 transition hover:border-rose-500 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {cancellingId === lock._id ? "..." : "Cancel"}
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      ) : null}

      <button
        type="button"
        onClick={() => setIsOpen((previous) => !previous)}
        className={`fixed right-5 z-50 inline-flex h-14 w-14 flex-col items-center justify-center rounded-full text-white shadow-2xl transition hover:scale-[1.02] ${buttonBottomClass} ${
          isAlert ? "bg-rose-600 hover:bg-rose-500" : activeLocks.length > 0 ? "bg-slate-900 hover:bg-slate-700" : "bg-sky-700 hover:bg-sky-600"
        }`}
        aria-label="Open price lock status"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4">
          <rect x="5" y="11" width="14" height="9" rx="2" />
          <path d="M8 11V8a4 4 0 118 0v3" />
        </svg>
        <span className="mt-0.5 text-[10px] font-semibold">{nearestLock ? formatCountdown(nearestRemaining) : "Idle"}</span>
      </button>
    </>
  );
}
