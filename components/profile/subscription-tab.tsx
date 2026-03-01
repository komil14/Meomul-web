import { useMutation, useQuery } from "@apollo/client/react";
import { useMemo } from "react";
import { ErrorNotice } from "@/components/ui/error-notice";
import { useToast } from "@/components/ui/toast-provider";
import {
  CANCEL_SUBSCRIPTION_MUTATION,
  GET_SUBSCRIPTION_STATUS_QUERY,
  REQUEST_SUBSCRIPTION_MUTATION,
} from "@/graphql/member.gql";
import { getSessionMember } from "@/lib/auth/session";
import { confirmDanger } from "@/lib/ui/alerts";
import { getErrorMessage } from "@/lib/utils/error";
import { Check } from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface SubscriptionStatusDto {
  tier: string;
  active: boolean;
  expiresAt?: string | null;
  daysRemaining?: number | null;
}

interface GetSubscriptionStatusData {
  getSubscriptionStatus: SubscriptionStatusDto;
}

// ─── Tier config ──────────────────────────────────────────────────────────────

const TIERS = [
  {
    id: "FREE",
    label: "Free",
    price: "₩0",
    period: "forever",
    features: ["Browse all hotels", "Make bookings", "Basic search filters", "Chat with hotels"],
  },
  {
    id: "BASIC",
    label: "Basic",
    price: "₩9,900",
    period: "/month",
    features: ["Everything in Free", "Price drop alerts", "Extended search history", "Priority chat support"],
  },
  {
    id: "PREMIUM",
    label: "Premium",
    price: "₩19,900",
    period: "/month",
    features: ["Everything in Basic", "Personalized recommendations", "Early access to deals", "Price lock (30 min holds)", "Advanced room filters"],
  },
  {
    id: "ELITE",
    label: "Elite",
    price: "₩39,900",
    period: "/month",
    features: ["Everything in Premium", "Concierge support 24/7", "Exclusive member-only rates", "Highest recommendation priority", "Special cancellation flexibility"],
  },
] as const;

const TIER_LABEL: Record<string, string> = {
  FREE: "Free", BASIC: "Basic", PREMIUM: "Premium", ELITE: "Elite",
};

// ─── SubscriptionTab ──────────────────────────────────────────────────────────

export function SubscriptionTab() {
  const toast = useToast();
  const member = useMemo(() => getSessionMember(), []);

  const { data, loading, error, refetch } = useQuery<GetSubscriptionStatusData>(
    GET_SUBSCRIPTION_STATUS_QUERY,
    {
      skip: !member,
      fetchPolicy: "cache-and-network",
      nextFetchPolicy: "cache-and-network",
    },
  );

  const [requestSubscription, { loading: requesting }] = useMutation(REQUEST_SUBSCRIPTION_MUTATION);
  const [cancelSubscription, { loading: cancelling }] = useMutation(CANCEL_SUBSCRIPTION_MUTATION);

  const status = data?.getSubscriptionStatus;
  const currentTier = status?.tier ?? "FREE";
  const isActive = status?.active ?? false;

  const handleRequest = async (tierId: string) => {
    if (tierId === currentTier) return;
    try {
      await requestSubscription({ variables: { requestedTier: tierId } });
      toast.success("Subscription request submitted. An admin will review it shortly.");
      void refetch();
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  const handleCancel = async () => {
    const confirmed = await confirmDanger({
      title: "Cancel subscription?",
      text: "Your current plan benefits will end when the subscription expires.",
      confirmText: "Yes, cancel",
    });
    if (!confirmed) return;
    try {
      await cancelSubscription();
      toast.success("Subscription cancelled.");
      void refetch();
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  return (
    <div className="space-y-5">
      {error && <ErrorNotice message={getErrorMessage(error)} />}

      {/* Current plan summary */}
      {!loading && status && (
        <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
          <div>
            <p className="text-sm font-medium text-slate-900">
              Current plan: <span className="font-semibold">{TIER_LABEL[currentTier] ?? currentTier}</span>
            </p>
            <p className="mt-0.5 text-xs text-slate-500">
              {isActive && status.daysRemaining != null
                ? `${status.daysRemaining} days remaining`
                : "No expiry"}
            </p>
          </div>
          {isActive && currentTier !== "FREE" && (
            <button
              type="button"
              onClick={() => { void handleCancel(); }}
              disabled={cancelling}
              className="text-xs font-medium text-rose-600 transition hover:text-rose-700 disabled:opacity-50"
            >
              {cancelling ? "Cancelling..." : "Cancel plan"}
            </button>
          )}
        </div>
      )}

      {/* Tier cards */}
      <div className="grid gap-3 sm:grid-cols-2">
        {TIERS.map((tier) => {
          const isCurrent = tier.id === currentTier;
          return (
            <div
              key={tier.id}
              className={`flex flex-col rounded-xl border p-4 transition ${
                isCurrent ? "border-slate-900 bg-white" : "border-slate-200 bg-white hover:border-slate-300"
              }`}
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-semibold text-slate-900">{tier.label}</p>
                  <p className="text-xs text-slate-500">
                    <span className="text-base font-bold text-slate-900">{tier.price}</span>
                    {" "}{tier.period}
                  </p>
                </div>
                {isCurrent && (
                  <span className="rounded-full bg-slate-900 px-2 py-0.5 text-[10px] font-semibold text-white">
                    Current
                  </span>
                )}
              </div>

              <ul className="mt-3 flex-1 space-y-1.5">
                {tier.features.map((f) => (
                  <li key={f} className="flex items-start gap-1.5 text-xs text-slate-600">
                    <Check size={11} className="mt-0.5 flex-shrink-0 text-emerald-500" />
                    {f}
                  </li>
                ))}
              </ul>

              {!isCurrent && (
                <button
                  type="button"
                  onClick={() => { void handleRequest(tier.id); }}
                  disabled={requesting}
                  className="mt-4 w-full rounded-lg border border-slate-200 py-2 text-xs font-medium text-slate-700 transition hover:border-slate-900 hover:text-slate-900 disabled:opacity-50"
                >
                  {tier.id === "FREE" ? "Downgrade to Free" : `Request ${tier.label}`}
                </button>
              )}
            </div>
          );
        })}
      </div>

      <p className="text-center text-xs text-slate-400">
        Subscription requests are manually reviewed. You'll be notified once approved.
      </p>
    </div>
  );
}
