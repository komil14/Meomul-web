import { useMutation } from "@apollo/client/react";
import { useRouter } from "next/router";
import { useMemo, useState } from "react";
import { ErrorNotice } from "@/components/ui/error-notice";
import { SAVE_ONBOARDING_PREFERENCES_MUTATION } from "@/graphql/recommendation.gql";
import {
  AMENITY_OPTIONS,
  BUDGET_OPTIONS,
  DESTINATION_OPTIONS,
  MAX_AMENITIES,
  MAX_DESTINATIONS,
  MAX_TRAVEL_STYLES,
  toggleWithLimit,
  TRAVEL_STYLE_OPTIONS,
} from "@/lib/recommendation/onboarding-options";
import { getErrorMessage } from "@/lib/utils/error";
import type { HotelLocation } from "@/types/hotel";
import type {
  BudgetLevel,
  SaveOnboardingPreferencesMutationData,
  SaveOnboardingPreferencesMutationVars,
  TravelStyle,
} from "@/types/recommendation";
import type { NextPageWithAuth } from "@/types/page";

const STEP_LABELS = ["Travel style", "Destinations", "Amenities", "Budget"] as const;

const OnboardingPage: NextPageWithAuth = () => {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [travelStyles, setTravelStyles] = useState<TravelStyle[]>([]);
  const [preferredDestinations, setPreferredDestinations] = useState<HotelLocation[]>([]);
  const [preferredAmenities, setPreferredAmenities] = useState<string[]>([]);
  const [budgetLevel, setBudgetLevel] = useState<BudgetLevel | undefined>(undefined);
  const [errorText, setErrorText] = useState<string | null>(null);

  const redirectTarget = useMemo(() => {
    if (typeof router.query.next !== "string") {
      return "/";
    }

    return router.query.next.startsWith("/") ? router.query.next : "/";
  }, [router.query.next]);

  const [saveOnboardingPreferences, { loading }] = useMutation<
    SaveOnboardingPreferencesMutationData,
    SaveOnboardingPreferencesMutationVars
  >(SAVE_ONBOARDING_PREFERENCES_MUTATION);

  const stepValidationMessage = useMemo(() => {
    if (step === 0 && travelStyles.length === 0) {
      return "Select at least 1 travel style.";
    }
    if (step === 1 && preferredDestinations.length === 0) {
      return "Select at least 1 preferred destination.";
    }
    return null;
  }, [preferredDestinations.length, step, travelStyles.length]);

  const canGoBack = step > 0 && !loading;
  const canGoNext = !stepValidationMessage && !loading;
  const isLastStep = step === STEP_LABELS.length - 1;

  const handleBack = () => {
    if (!canGoBack) return;
    setErrorText(null);
    setStep((prev) => Math.max(0, prev - 1));
  };

  const handleNext = async () => {
    if (!canGoNext) return;
    setErrorText(null);

    if (!isLastStep) {
      setStep((prev) => Math.min(STEP_LABELS.length - 1, prev + 1));
      return;
    }

    try {
      await saveOnboardingPreferences({
        variables: {
          input: {
            travelStyles,
            preferredAmenities,
            preferredDestinations,
            ...(budgetLevel ? { budgetLevel } : {}),
          },
        },
      });
      await router.push(redirectTarget);
    } catch (error) {
      setErrorText(getErrorMessage(error));
    }
  };

  return (
    <main className="mx-auto w-full max-w-4xl space-y-6">
      <header className="space-y-2">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">Onboarding</p>
        <h1 className="text-3xl font-semibold text-slate-900 sm:text-4xl">Set your stay preferences</h1>
        <p className="max-w-2xl text-sm text-slate-600 sm:text-base">
          We use these answers to personalize hotel recommendations on your homepage.
        </p>
      </header>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8">
        <div className="mb-6 space-y-3">
          <div className="flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
            {STEP_LABELS.map((label, index) => (
              <span key={label} className={index === step ? "text-slate-900" : undefined}>
                {index + 1}. {label}
              </span>
            ))}
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200">
            <div
              className="h-full rounded-full bg-slate-900 transition-all"
              style={{ width: `${((step + 1) / STEP_LABELS.length) * 100}%` }}
            />
          </div>
        </div>

        {step === 0 ? (
          <div className="space-y-3">
            <h2 className="text-xl font-semibold text-slate-900">How do you usually travel?</h2>
            <p className="text-sm text-slate-600">Select up to {MAX_TRAVEL_STYLES} styles.</p>
            <div className="grid gap-3 sm:grid-cols-2">
              {TRAVEL_STYLE_OPTIONS.map((option) => {
                const selected = travelStyles.includes(option.value);
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setTravelStyles((prev) => toggleWithLimit(prev, option.value, MAX_TRAVEL_STYLES))}
                    className={`rounded-xl border px-4 py-3 text-left transition ${
                      selected ? "border-slate-900 bg-slate-900 text-white" : "border-slate-300 bg-white text-slate-800"
                    }`}
                  >
                    <p className="font-semibold">{option.label}</p>
                    <p className={`mt-1 text-sm ${selected ? "text-slate-200" : "text-slate-600"}`}>{option.description}</p>
                  </button>
                );
              })}
            </div>
          </div>
        ) : null}

        {step === 1 ? (
          <div className="space-y-3">
            <h2 className="text-xl font-semibold text-slate-900">Where do you prefer to stay?</h2>
            <p className="text-sm text-slate-600">Select up to {MAX_DESTINATIONS} destinations.</p>
            <div className="flex flex-wrap gap-2">
              {DESTINATION_OPTIONS.map((option) => {
                const selected = preferredDestinations.includes(option.value);
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() =>
                      setPreferredDestinations((prev) => toggleWithLimit(prev, option.value, MAX_DESTINATIONS))
                    }
                    className={`rounded-full border px-4 py-2 text-sm font-medium transition ${
                      selected ? "border-slate-900 bg-slate-900 text-white" : "border-slate-300 bg-white text-slate-700"
                    }`}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>
          </div>
        ) : null}

        {step === 2 ? (
          <div className="space-y-3">
            <h2 className="text-xl font-semibold text-slate-900">What amenities matter most?</h2>
            <p className="text-sm text-slate-600">Select up to {MAX_AMENITIES}. You can skip this step.</p>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {AMENITY_OPTIONS.map((option) => {
                const selected = preferredAmenities.includes(option.value);
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setPreferredAmenities((prev) => toggleWithLimit(prev, option.value, MAX_AMENITIES))}
                    className={`rounded-lg border px-3 py-2 text-left text-sm transition ${
                      selected ? "border-slate-900 bg-slate-900 text-white" : "border-slate-300 bg-white text-slate-700"
                    }`}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>
          </div>
        ) : null}

        {step === 3 ? (
          <div className="space-y-3">
            <h2 className="text-xl font-semibold text-slate-900">What is your budget range?</h2>
            <p className="text-sm text-slate-600">Optional. Pick one level for better price matching.</p>
            <div className="grid gap-3 sm:grid-cols-2">
              {BUDGET_OPTIONS.map((option) => {
                const selected = budgetLevel === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setBudgetLevel((prev) => (prev === option.value ? undefined : option.value))}
                    className={`rounded-xl border px-4 py-3 text-left transition ${
                      selected ? "border-slate-900 bg-slate-900 text-white" : "border-slate-300 bg-white text-slate-800"
                    }`}
                  >
                    <p className="font-semibold">{option.label}</p>
                    <p className={`mt-1 text-sm ${selected ? "text-slate-200" : "text-slate-600"}`}>{option.range}</p>
                  </button>
                );
              })}
            </div>
          </div>
        ) : null}

        {stepValidationMessage ? <ErrorNotice className="mt-5" tone="warn" message={stepValidationMessage} /> : null}
        {errorText ? <ErrorNotice className="mt-5" message={errorText} /> : null}

        <footer className="mt-8 flex items-center justify-between">
          <button
            type="button"
            onClick={handleBack}
            disabled={!canGoBack}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Back
          </button>

          <button
            type="button"
            onClick={() => {
              void handleNext();
            }}
            disabled={!canGoNext}
            className="rounded-lg bg-slate-900 px-5 py-2 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? "Saving..." : isLastStep ? "Finish" : "Next"}
          </button>
        </footer>
      </section>
    </main>
  );
};

OnboardingPage.auth = { roles: ["USER"] };

export default OnboardingPage;
