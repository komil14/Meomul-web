import { useMutation } from "@apollo/client/react";
import Link from "next/link";
import { useRouter } from "next/router";
import { useMemo, useState } from "react";
import { LOGIN_MEMBER_MUTATION } from "@/graphql/auth.gql";
import { useI18n } from "@/lib/i18n/provider";
import { resolvePostAuthRedirect } from "@/lib/auth/post-auth-redirect";
import { saveAuthSession } from "@/lib/auth/session";
import { errorAlert, infoAlert, successAlert } from "@/lib/ui/alerts";
import { getErrorMessage } from "@/lib/utils/error";
import type { AuthMember, LoginMemberMutationVars } from "@/types/auth";
import type { NextPageWithAuth } from "@/types/page";

interface LoginMemberMutationData {
  loginMember: AuthMember;
}

const LoginPage: NextPageWithAuth = () => {
  const { t } = useI18n();
  const router = useRouter();
  const [memberNick, setMemberNick] = useState("");
  const [memberPassword, setMemberPassword] = useState("");

  const redirectTarget = useMemo(() => {
    if (typeof router.query.next !== "string") {
      return "/";
    }

    return router.query.next.startsWith("/") ? router.query.next : "/";
  }, [router.query.next]);

  const [loginMember, { loading }] = useMutation<
    LoginMemberMutationData,
    LoginMemberMutationVars
  >(LOGIN_MEMBER_MUTATION);

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const nick = memberNick.trim();
    if (nick.length < 3 || nick.length > 24) {
      await errorAlert(t("auth_validation_title"), t("auth_validation_nick"));
      return;
    }
    if (memberPassword.length < 6 || memberPassword.length > 72) {
      await errorAlert(t("auth_validation_title"), t("auth_validation_password_range"));
      return;
    }

    try {
      const response = await loginMember({
        variables: {
          input: {
            memberNick,
            memberPassword,
          },
        },
      });

      const authMember = response.data?.loginMember;
      if (!authMember) {
        await infoAlert(t("auth_login_response_missing_title"), t("auth_login_response_missing_body"));
        return;
      }

      saveAuthSession(authMember);
      const nextRoute = await resolvePostAuthRedirect(
        authMember,
        redirectTarget,
      );
      await successAlert(t("auth_login_success_title"), t("auth_login_success_body"));
      await router.push(nextRoute);
    } catch (error) {
      await errorAlert(t("auth_login_failed_title"), getErrorMessage(error));
    }
  };

  return (
    <main className="mx-auto flex w-full max-w-md flex-col justify-center">
      <h1 className="text-3xl font-semibold text-slate-900">{t("auth_login_title")}</h1>
      <p className="mt-2 text-sm text-slate-600">
        {t("auth_login_desc")}
      </p>

      <section className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-5">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
          Host access
        </p>
        <h2 className="mt-2 text-lg font-semibold text-slate-900">
          Want to list a hotel on Meomul?
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-slate-600">
          Start with a normal account, then apply for host access through the dedicated onboarding flow.
        </p>
        <Link
          href="/become-a-host"
          className="mt-4 inline-flex items-center rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-700"
        >
          Become a host
        </Link>
      </section>

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
            {t("auth_password")}
          </span>
          <input
            type="password"
            value={memberPassword}
            onChange={(event) => setMemberPassword(event.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none ring-slate-900 transition focus:ring-2"
            autoComplete="current-password"
            minLength={6}
            maxLength={72}
            required
          />
        </label>

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? t("auth_login_loading") : t("auth_login_submit")}
        </button>
      </form>

      <div className="mt-6 flex flex-wrap gap-3 text-sm text-slate-600">
        <Link href="/auth/signup" className="underline underline-offset-4">
          {t("auth_create_account")}
        </Link>
        <Link
          href="/auth/forgot-password"
          className="underline underline-offset-4"
        >
          {t("auth_forgot_password")}
        </Link>
      </div>
    </main>
  );
};

LoginPage.auth = { guestOnly: true };

export default LoginPage;
