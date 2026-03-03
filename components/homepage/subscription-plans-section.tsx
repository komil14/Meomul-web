import Link from "next/link";
import { Check, Crown } from "lucide-react";
import { useMemo } from "react";
import { getSessionMember } from "@/lib/auth/session";

// ─── Tier definitions ──────────────────────────────────────────────────────────

interface Tier {
  id: string;
  label: string;
  price: string;
  period: string;
  popular: boolean;
  features: string[];
}

const TIERS: Tier[] = [
  {
    id: "FREE",
    label: "Free",
    price: "₩0",
    period: "forever",
    popular: false,
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
    popular: false,
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
    popular: true,
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
    popular: false,
    features: [
      "Everything in Premium",
      "Concierge support 24/7",
      "Exclusive member-only rates",
      "Highest recommendation priority",
      "Special cancellation flexibility",
    ],
  },
];

// ─── Component ─────────────────────────────────────────────────────────────────

export function SubscriptionPlansSection() {
  const member = useMemo(() => getSessionMember(), []);
  const ctaHref = member ? "/profile?tab=subscription" : "/auth/signup";
  const ctaLabel = member ? "View plans" : "Get started free";

  return (
    <section className="border-t border-slate-100 py-16">
      {/* Header */}
      <div className="mb-10 text-center">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-500">
          <Crown size={11} />
          Membership Plans
        </span>
        <h2 className="mt-3 text-3xl font-bold tracking-tight text-slate-900">
          Simple, transparent pricing
        </h2>
        <p className="mt-2 text-sm text-slate-500">
          Browse free. Upgrade when you&apos;re ready.
        </p>
      </div>

      {/* Tier grid */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {TIERS.map((tier) => (
          <div
            key={tier.id}
            className={`relative flex flex-col rounded-2xl p-6 ${
              tier.popular
                ? "border-2 border-slate-900 bg-white shadow-sm"
                : "border border-slate-100 bg-white"
            }`}
          >
            {tier.popular && (
              <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-slate-900 px-3 py-0.5 text-[11px] font-semibold text-white">
                Most popular
              </span>
            )}

            <Crown
              size={15}
              className={tier.popular ? "text-slate-900" : "text-slate-300"}
            />

            <p className="mt-3 text-base font-bold text-slate-900">{tier.label}</p>

            <p className="mt-1 flex items-baseline gap-1">
              <span className="text-2xl font-bold text-slate-900">{tier.price}</span>
              <span className="text-xs text-slate-400">{tier.period}</span>
            </p>

            <ul className="mt-5 flex-1 space-y-2">
              {tier.features.map((feature) => (
                <li key={feature} className="flex items-start gap-2 text-sm text-slate-600">
                  <Check size={13} className="mt-0.5 flex-shrink-0 text-emerald-500" />
                  {feature}
                </li>
              ))}
            </ul>

            <Link
              href={ctaHref}
              className={`mt-6 block rounded-lg px-4 py-2 text-center text-sm font-medium transition ${
                tier.popular
                  ? "bg-slate-900 text-white hover:bg-slate-700"
                  : "border border-slate-200 text-slate-700 hover:border-slate-400"
              }`}
            >
              {ctaLabel}
            </Link>
          </div>
        ))}
      </div>

      {/* Footnote */}
      <p className="mt-6 text-center text-xs text-slate-400">
        Paid plans require admin approval &middot; No automatic charges
      </p>
    </section>
  );
}
