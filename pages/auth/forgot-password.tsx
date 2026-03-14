import { useMutation } from "@apollo/client/react";
import Link from "next/link";
import { useRouter } from "next/router";
import { useMemo, useState } from "react";
import { RESET_PASSWORD_MUTATION } from "@/graphql/auth.gql";
import { errorAlert, successAlert } from "@/lib/ui/alerts";
import { getErrorMessage } from "@/lib/utils/error";
import type {
  ResetPasswordMutationData,
  ResetPasswordMutationVars,
} from "@/types/auth";
import type { NextPageWithAuth } from "@/types/page";

const ForgotPasswordPage: NextPageWithAuth = () => {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [memberNick, setMemberNick] = useState("");
  const [memberPhone, setMemberPhone] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [resetPassword, { loading }] = useMutation<
    ResetPasswordMutationData,
    ResetPasswordMutationVars
  >(RESET_PASSWORD_MUTATION);

  const progress = useMemo(() => (step === 1 ? 50 : 100), [step]);

  const validateIdentityStep = async () => {
    const nick = memberNick.trim();
    const normalizedPhone = memberPhone.replace(/-/g, "").trim();

    if (nick.length < 3 || nick.length > 24) {
      await errorAlert("Check your details", "Enter a valid username.");
      return false;
    }

    if (!/^[0-9]{10,11}$/.test(normalizedPhone)) {
      await errorAlert("Check your details", "Enter the phone number used on your account.");
      return false;
    }

    return true;
  };

  const validatePasswordStep = async () => {
    if (newPassword.length < 6) {
      await errorAlert("Choose a stronger password", "Password must be at least 6 characters.");
      return false;
    }

    if (newPassword.length > 72) {
      await errorAlert("Choose a stronger password", "Password must be 72 characters or fewer.");
      return false;
    }

    if (newPassword !== confirmPassword) {
      await errorAlert("Passwords do not match", "Confirm the same new password to continue.");
      return false;
    }

    return true;
  };

  const onContinue = async () => {
    const valid = await validateIdentityStep();
    if (!valid) return;
    setStep(2);
  };

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const identityValid = await validateIdentityStep();
    if (!identityValid) {
      setStep(1);
      return;
    }

    const passwordValid = await validatePasswordStep();
    if (!passwordValid) return;

    try {
      const response = await resetPassword({
        variables: {
          input: {
            memberNick: memberNick.trim(),
            memberPhone: memberPhone.replace(/-/g, "").trim(),
            newPassword,
          },
        },
      });

      if (!response.data?.resetPassword.success) {
        await errorAlert("Reset password", "Password reset could not be completed.");
        return;
      }

      await successAlert(
        "Password updated",
        "Your password was changed. Log in again with the new password.",
      );
      await router.push("/auth/login");
    } catch (error) {
      await errorAlert("Reset password", getErrorMessage(error));
    }
  };

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col justify-center">
      <div className="rounded-[2rem] border border-slate-200 bg-white shadow-[0_24px_80px_-44px_rgba(15,23,42,0.35)]">
        <div className="border-b border-slate-100 px-6 py-5 sm:px-8">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                Account recovery
              </p>
              <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-900">
                Reset your password
              </h1>
              <p className="mt-2 text-sm leading-relaxed text-slate-500">
                First confirm your username and phone number, then choose a new password.
              </p>
            </div>
            <Link
              href="/auth/login"
              className="hidden rounded-full border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 transition hover:border-slate-300 hover:text-slate-900 sm:inline-flex"
            >
              Back to login
            </Link>
          </div>
        </div>

        <div className="px-6 pt-6 sm:px-8">
          <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
            <span>Step {step} of 2</span>
            <span>{step === 1 ? "Identity check" : "New password"}</span>
          </div>
          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full bg-slate-900 transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        <form className="grid gap-8 px-6 py-8 sm:px-8 lg:grid-cols-[0.92fr_1.08fr]" onSubmit={onSubmit}>
          <section className="rounded-[1.75rem] border border-slate-200 bg-slate-50 p-6">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
              Recovery flow
            </p>
            <div className="mt-4 space-y-4">
              <div className={`rounded-2xl border p-4 ${step === 1 ? "border-slate-900 bg-white shadow-sm" : "border-slate-200 bg-white/70"}`}>
                <p className="text-sm font-semibold text-slate-900">1. Verify your account</p>
                <p className="mt-1 text-sm leading-relaxed text-slate-500">
                  Enter the username and phone number already saved on your account.
                </p>
              </div>
              <div className={`rounded-2xl border p-4 ${step === 2 ? "border-slate-900 bg-white shadow-sm" : "border-slate-200 bg-white/70"}`}>
                <p className="text-sm font-semibold text-slate-900">2. Set a new password</p>
                <p className="mt-1 text-sm leading-relaxed text-slate-500">
                  Choose a new password and confirm it before returning to login.
                </p>
              </div>
            </div>
          </section>

          <section className="space-y-5">
            {step === 1 ? (
              <>
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                    Identity check
                  </p>
                  <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">
                    Confirm your username and phone
                  </h2>
                  <p className="mt-2 text-sm leading-relaxed text-slate-500">
                    We will use these details to match your existing account before the password is changed.
                  </p>
                </div>

                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-slate-700">
                    Username
                  </span>
                  <input
                    value={memberNick}
                    onChange={(event) => setMemberNick(event.target.value)}
                    className="w-full rounded-2xl border border-slate-300 px-4 py-3 outline-none ring-slate-900 transition focus:ring-2"
                    autoComplete="username"
                    minLength={3}
                    maxLength={24}
                    required
                  />
                </label>

                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-slate-700">
                    Phone number
                  </span>
                  <input
                    value={memberPhone}
                    onChange={(event) => setMemberPhone(event.target.value)}
                    className="w-full rounded-2xl border border-slate-300 px-4 py-3 outline-none ring-slate-900 transition focus:ring-2"
                    autoComplete="tel"
                    placeholder="01012345678"
                    maxLength={13}
                    required
                  />
                </label>
              </>
            ) : (
              <>
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                    New password
                  </p>
                  <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">
                    Choose a new password
                  </h2>
                  <p className="mt-2 text-sm leading-relaxed text-slate-500">
                    Use a password between 6 and 72 characters. All existing sessions will be signed out after reset.
                  </p>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                  <span className="font-medium text-slate-900">{memberNick.trim() || "Username"}</span>
                  {" · "}
                  <span>{memberPhone.trim() || "Phone number"}</span>
                </div>

                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-slate-700">
                    New password
                  </span>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(event) => setNewPassword(event.target.value)}
                    className="w-full rounded-2xl border border-slate-300 px-4 py-3 outline-none ring-slate-900 transition focus:ring-2"
                    autoComplete="new-password"
                    minLength={6}
                    maxLength={72}
                    required
                  />
                </label>

                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-slate-700">
                    Confirm new password
                  </span>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(event) => setConfirmPassword(event.target.value)}
                    className="w-full rounded-2xl border border-slate-300 px-4 py-3 outline-none ring-slate-900 transition focus:ring-2"
                    autoComplete="new-password"
                    minLength={6}
                    maxLength={72}
                    required
                  />
                </label>
              </>
            )}

            <div className="flex flex-col gap-3 pt-2 sm:flex-row">
              {step === 2 ? (
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="inline-flex items-center justify-center rounded-2xl border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                >
                  Back
                </button>
              ) : null}
              {step === 1 ? (
                <button
                  type="button"
                  onClick={onContinue}
                  className="inline-flex items-center justify-center rounded-2xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-700"
                >
                  Continue
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={loading}
                  className="inline-flex items-center justify-center rounded-2xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {loading ? "Updating password..." : "Update password"}
                </button>
              )}
            </div>
          </section>
        </form>

        <div className="border-t border-slate-100 px-6 py-4 text-sm text-slate-500 sm:px-8">
          Need help instead?{" "}
          <Link href="/support" className="font-medium text-slate-900 underline underline-offset-4">
            Contact support
          </Link>
          .
        </div>
      </div>
    </main>
  );
};

ForgotPasswordPage.auth = { guestOnly: true };

export default ForgotPasswordPage;
