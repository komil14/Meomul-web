import { useMutation } from "@apollo/client/react";
import Link from "next/link";
import { useRouter } from "next/router";
import { useMemo, useState } from "react";
import { SIGNUP_MEMBER_MUTATION } from "@/graphql/auth.gql";
import { useI18n } from "@/lib/i18n/provider";
import { resolvePostAuthRedirect } from "@/lib/auth/post-auth-redirect";
import { saveAuthSession } from "@/lib/auth/session";
import { errorAlert, infoAlert, successAlert } from "@/lib/ui/alerts";
import { getErrorMessage } from "@/lib/utils/error";
import type { AuthMember, SignupMemberMutationVars } from "@/types/auth";
import type { NextPageWithAuth } from "@/types/page";

interface SignupMemberMutationData {
  signupMember: AuthMember;
}

const SignupPage: NextPageWithAuth = () => {
  const { t } = useI18n();
  const router = useRouter();
  const [memberNick, setMemberNick] = useState("");
  const [memberFullName, setMemberFullName] = useState("");
  const [memberPhone, setMemberPhone] = useState("");
  const [memberPassword, setMemberPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const redirectTarget = useMemo(() => {
    if (typeof router.query.next !== "string") {
      return "/";
    }

    return router.query.next.startsWith("/") ? router.query.next : "/";
  }, [router.query.next]);

  const [signupMember, { loading }] = useMutation<
    SignupMemberMutationData,
    SignupMemberMutationVars
  >(SIGNUP_MEMBER_MUTATION);

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const nick = memberNick.trim();
    if (nick.length < 3 || nick.length > 24) {
      await errorAlert(t("auth_validation_title"), t("auth_validation_nick"));
      return;
    }
    if (!/^[0-9]{10,11}$/.test(memberPhone.replace(/-/g, ""))) {
      await errorAlert(t("auth_validation_title"), t("auth_validation_phone"));
      return;
    }
    if (memberPassword.length < 6) {
      await errorAlert(t("auth_validation_title"), t("auth_validation_password_min"));
      return;
    }
    if (memberPassword.length > 72) {
      await errorAlert(t("auth_validation_title"), t("auth_validation_password_max"));
      return;
    }

    if (memberPassword !== confirmPassword) {
      await errorAlert(t("auth_validation_password_mismatch_title"), t("auth_validation_password_mismatch_body"));
      return;
    }

    try {
      const response = await signupMember({
        variables: {
          input: {
            memberNick,
            memberFullName: memberFullName || undefined,
            memberPhone,
            memberPassword,
            memberType: "USER",
            memberAuthType: "EMAIL",
          },
        },
      });

      const authMember = response.data?.signupMember;
      if (!authMember) {
        await infoAlert(t("auth_signup_response_missing_title"), t("auth_signup_response_missing_body"));
        return;
      }

      saveAuthSession(authMember);
      const nextRoute = await resolvePostAuthRedirect(
        authMember,
        redirectTarget,
      );
      await successAlert(t("auth_signup_success_title"), t("auth_signup_success_body"));
      await router.push(nextRoute);
    } catch (error) {
      await errorAlert(t("auth_signup_failed_title"), getErrorMessage(error));
    }
  };

  return (
    <main className="mx-auto flex w-full max-w-md flex-col justify-center">
      <h1 className="text-3xl font-semibold text-slate-900">{t("auth_signup_title")}</h1>
      <p className="mt-2 text-sm text-slate-600">
        {t("auth_signup_desc")}
      </p>

      <form
        className="mt-8 space-y-4 rounded-2xl border border-slate-200 bg-white p-6"
        onSubmit={onSubmit}
      >
        <label className="block">
          <span className="mb-2 block text-sm font-medium text-slate-700">
            {t("auth_member_nick")}
          </span>
          <input
            value={memberNick}
            onChange={(event) => setMemberNick(event.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none ring-slate-900 transition focus:ring-2"
            autoComplete="username"
            minLength={3}
            maxLength={24}
            required
          />
        </label>

        <label className="block">
          <span className="mb-2 block text-sm font-medium text-slate-700">
            {t("auth_full_name_optional")}
          </span>
          <input
            value={memberFullName}
            onChange={(event) => setMemberFullName(event.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none ring-slate-900 transition focus:ring-2"
            autoComplete="name"
          />
        </label>

        <label className="block">
          <span className="mb-2 block text-sm font-medium text-slate-700">
            {t("auth_phone")}
          </span>
          <input
            value={memberPhone}
            onChange={(event) => setMemberPhone(event.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none ring-slate-900 transition focus:ring-2"
            autoComplete="tel"
            placeholder={t("auth_phone_placeholder")}
            maxLength={13}
            required
          />
        </label>

        <label className="block">
          <span className="mb-2 block text-sm font-medium text-slate-700">
            {t("auth_password")}
          </span>
          <input
            type="password"
            value={memberPassword}
            onChange={(event) => setMemberPassword(event.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none ring-slate-900 transition focus:ring-2"
            autoComplete="new-password"
            required
          />
        </label>

        <label className="block">
          <span className="mb-2 block text-sm font-medium text-slate-700">
            {t("auth_confirm_password")}
          </span>
          <input
            type="password"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none ring-slate-900 transition focus:ring-2"
            autoComplete="new-password"
            required
          />
        </label>

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? t("auth_signup_loading") : t("auth_signup_submit")}
        </button>
      </form>

      <div className="mt-6 text-sm text-slate-600">
        <Link href="/auth/login" className="underline underline-offset-4">
          {t("auth_have_account")}
        </Link>
      </div>
    </main>
  );
};

SignupPage.auth = { guestOnly: true };

export default SignupPage;
