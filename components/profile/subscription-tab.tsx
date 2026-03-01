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
import { Check, Crown } from "lucide-react";

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
    color: "border-slate-200",
    headerBg: "bg-slate-50",
    accentText: "text-slate-700",
    badge: null as string | null,
    features: [
      "Browse all hotels",
      "Make bookings",
      "Basic search filters",
      "Chat with hotels",
    ],
  },
  {
    id: "BASIC",
    label: "Basic",
    price: "₩9,900",
    period: "/month",
    color: "border-sky-200",
    headerBg: "bg-sky-50",
    accentText: "text-sky-600",
    badge: null as string | null,
    features: [
      "Everything in Free",
      "Price drop alerts",
      "Extended search history",
      "Priority chat support",
    ],
  },
  {
    id: "PREMIUM",
    label: "Premium",
    price: "₩19,900",
    period: "/month",
    color: "border-violet-200",
    headerBg: "bg-violet-50",
    accentText: "text-violet-600",
    badge: "Popular",
    features: [
      "Everything in Basic",
      "Personalized recommendations",
      "Early access to deals",
      "Price lock (30 min holds)",
      "Advanced room filters",
    ],
  },
  {
    id: "ELITE",
    label: "Elite",
    price: "₩39,900",
    period: "/month",
    color: "border-amber-200",
    headerBg: "bg-amber-50",
    accentText: "text-amber-600",
    badge: "Best value",
    features: [
      "Everything in Premium",
      "Concierge support 24/7",
      "Exclusive member-only rates",
      "Highest recommendation priority",
      "Special cancellation flexibility",
    ],
  },
] as const;

// ─── Hero style maps ──────────────────────────────────────────────────────────

const TIER_LABEL: Record<string, string> = {
  FREE: "Free", BASIC: "Basic", PREMIUM: "Premium", ELITE: "Elite",
};

const TIER_ICON_RING: Record<string, string> = {
  FREE: "border-slate-400/30 bg-slate-400/15",
  BASIC: "border-sky-400/30 bg-sky-400/15",
  PREMIUM: "border-violet-400/30 bg-violet-400/15",
  ELITE: "border-amber-400/30 bg-amber-400/15",
};

const TIER_CROWN_COLOR: Record<string, string> = {
  FREE: "text-slate-300",
  BASIC: "text-sky-400",
  PREMIUM: "text-violet-400",
  ELITE: "text-amber-400",
};

const TIER_RADIAL_COLOR: Record<string, string> = {
  FREE: "rgba(99,102,241,0.14)",
  BASIC: "rgba(14,165,233,0.18)",
  PREMIUM: "rgba(139,92,246,0.18)",
  ELITE: "rgba(245,158,11,0.20)",
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
  const radialColor = TIER_RADIAL_COLOR[currentTier] ?? TIER_RADIAL_COLOR.FREE;

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
      {/* ── Subscription hero ─────────────────────────────────────────────── */}
      {!loading && (
        <section className="relative overflow-hidden rounded-[2rem] bg-slate-950 shadow-xl">
          <div className="absolute inset-0 bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950/80" />
          <div
            className="absolute inset-0"
            style={{ background: `radial-gradient(ellipse 80% 60% at top right, ${radialColor}, transparent)` }}
          />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_55%_45%_at_bottom_left,rgba(14,165,233,0.08),transparent)]" />
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />

          <div className="relative p-6 sm:p-8">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className={`flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-2xl border ${TIER_ICON_RING[currentTier] ?? TIER_ICON_RING.FREE}`}>
                  <Crown size={24} className={TIER_CROWN_COLOR[currentTier] ?? TIER_CROWN_COLOR.FREE} />
                </div>
                <div>
                  <p className="text-lg font-bold text-white">
                    {TIER_LABEL[currentTier] ?? currentTier} plan
                  </p>
                  <p className="text-sm text-slate-400">
                    {isActive && status?.daysRemaining != null
                      ? `${status.daysRemaining} days remaining`
                      : "No expiry · Free tier"}
                  </p>
                </div>
              </div>
              {isActive && currentTier !== "FREE" && (
                <button
                  type="button"
                  onClick={() => { void handleCancel(); }}
                  disabled={cancelling}
                  className="flex-shrink-0 rounded-xl border border-rose-400/40 bg-rose-400/15 px-3 py-1.5 text-xs font-semibold text-rose-300 transition hover:bg-rose-400/25 disabled:opacity-60"
                >
                  {cancelling ? "Cancelling..." : "Cancel plan"}
                </button>
              )}
            </div>
          </div>
        </section>
      )}

      {error && <ErrorNotice message={getErrorMessage(error)} />}

      {/* Tier cards */}
      <div className="grid gap-4 sm:grid-cols-2">
        {TIERS.map((tier) => {
          const isCurrent = tier.id === currentTier;
          return (
            <div
              key={tier.id}
              className={`relative flex flex-col rounded-2xl border-2 bg-white p-5 transition ${
                isCurrent ? `${tier.color} shadow-md` : "border-slate-100 hover:border-slate-200"
              }`}
            >
              {tier.badge && (
                <span className="absolute -top-2.5 right-4 rounded-full bg-slate-900 px-2.5 py-0.5 text-[10px] font-bold text-white">
                  {tier.badge}
                </span>
              )}

              <div className={`-mx-5 -mt-5 mb-4 rounded-t-xl px-5 py-4 ${tier.headerBg}`}>
                <p className={`text-lg font-bold ${tier.accentText}`}>{tier.label}</p>
                <p className="text-slate-700">
                  <span className="text-2xl font-bold">{tier.price}</span>
                  <span className="ml-1 text-sm text-slate-500">{tier.period}</span>
                </p>
              </div>

              <ul className="mb-5 flex-1 space-y-2">
                {tier.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm text-slate-700">
                    <Check size={13} className="mt-0.5 flex-shrink-0 text-emerald-500" />
                    {f}
                  </li>
                ))}
              </ul>

              {isCurrent ? (
                <div className={`rounded-lg py-2 text-center text-sm font-semibold ${tier.accentText} bg-white border ${tier.color}`}>
                  Current plan
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => { void handleRequest(tier.id); }}
                  disabled={requesting}
                  className="w-full rounded-xl bg-slate-900 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:opacity-60"
                >
                  {tier.id === "FREE" ? "Downgrade to Free" : `Request ${tier.label}`}
                </button>
              )}
            </div>
          );
        })}
      </div>

      <p className="text-center text-xs text-slate-400">
        Subscription requests are manually reviewed by our team. You will receive a notification once approved.
      </p>
    </div>
  );
}
