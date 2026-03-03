import { useMutation } from "@apollo/client/react";
import Link from "next/link";
import { useRouter } from "next/router";
import { useMemo, useState } from "react";
import { LOGIN_MEMBER_MUTATION } from "@/graphql/auth.gql";
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
        await infoAlert("Login response missing", "Login response is empty.");
        return;
      }

      saveAuthSession(authMember);
      const nextRoute = await resolvePostAuthRedirect(
        authMember,
        redirectTarget,
      );
      await successAlert("Login successful", "You are now signed in.");
      await router.push(nextRoute);
    } catch (error) {
      await errorAlert("Login failed", getErrorMessage(error));
    }
  };

  return (
    <main className="mx-auto flex w-full max-w-md flex-col justify-center">
      <h1 className="text-3xl font-semibold text-slate-900">Login</h1>
      <p className="mt-2 text-sm text-slate-600">
        Use your member nick and password to continue.
      </p>

      <form
        className="mt-8 space-y-4 rounded-2xl border border-slate-200 bg-white p-6"
        onSubmit={onSubmit}
      >
        <label className="block">
          <span className="mb-2 block text-sm font-medium text-slate-700">
            Member Nick
          </span>
          <input
            value={memberNick}
            onChange={(event) => setMemberNick(event.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none ring-slate-900 transition focus:ring-2"
            autoComplete="username"
            required
          />
        </label>

        <label className="block">
          <span className="mb-2 block text-sm font-medium text-slate-700">
            Password
          </span>
          <input
            type="password"
            value={memberPassword}
            onChange={(event) => setMemberPassword(event.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none ring-slate-900 transition focus:ring-2"
            autoComplete="current-password"
            required
          />
        </label>

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? "Logging in..." : "Login"}
        </button>
      </form>

      <div className="mt-6 flex flex-wrap gap-3 text-sm text-slate-600">
        <Link href="/auth/signup" className="underline underline-offset-4">
          Create account
        </Link>
        <Link
          href="/auth/forgot-password"
          className="underline underline-offset-4"
        >
          Forgot password
        </Link>
      </div>
    </main>
  );
};

LoginPage.auth = { guestOnly: true };

export default LoginPage;
