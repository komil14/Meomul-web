import { useMutation } from "@apollo/client/react";
import Link from "next/link";
import { useRouter } from "next/router";
import { useState } from "react";
import { SIGNUP_MEMBER_MUTATION } from "@/graphql/auth.gql";
import { saveAuthSession } from "@/lib/auth/session";
import { getErrorMessage } from "@/lib/utils/error";
import type { AuthMember, SignupMemberMutationVars } from "@/types/auth";
import type { NextPageWithAuth } from "@/types/page";

interface SignupMemberMutationData {
  signupMember: AuthMember;
}

const SignupPage: NextPageWithAuth = () => {
  const router = useRouter();
  const [memberNick, setMemberNick] = useState("");
  const [memberFullName, setMemberFullName] = useState("");
  const [memberPhone, setMemberPhone] = useState("");
  const [memberPassword, setMemberPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [errorText, setErrorText] = useState<string | null>(null);

  const [signupMember, { loading }] = useMutation<SignupMemberMutationData, SignupMemberMutationVars>(
    SIGNUP_MEMBER_MUTATION,
  );

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorText(null);

    if (memberPassword !== confirmPassword) {
      setErrorText("Passwords do not match.");
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
        setErrorText("Signup response is empty.");
        return;
      }

      saveAuthSession(authMember);
      await router.push("/dashboard");
    } catch (error) {
      setErrorText(getErrorMessage(error));
    }
  };

  return (
    <main className="mx-auto flex w-full max-w-md flex-col justify-center">
      <h1 className="text-3xl font-semibold text-slate-900">Create Account</h1>
      <p className="mt-2 text-sm text-slate-600">New registrations are created with USER role and EMAIL auth.</p>

      <form className="mt-8 space-y-4 rounded-2xl border border-slate-200 bg-white p-6" onSubmit={onSubmit}>
        <label className="block">
          <span className="mb-2 block text-sm font-medium text-slate-700">Member Nick</span>
          <input
            value={memberNick}
            onChange={(event) => setMemberNick(event.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none ring-slate-900 transition focus:ring-2"
            autoComplete="username"
            required
          />
        </label>

        <label className="block">
          <span className="mb-2 block text-sm font-medium text-slate-700">Full Name (Optional)</span>
          <input
            value={memberFullName}
            onChange={(event) => setMemberFullName(event.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none ring-slate-900 transition focus:ring-2"
            autoComplete="name"
          />
        </label>

        <label className="block">
          <span className="mb-2 block text-sm font-medium text-slate-700">Phone</span>
          <input
            value={memberPhone}
            onChange={(event) => setMemberPhone(event.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none ring-slate-900 transition focus:ring-2"
            autoComplete="tel"
            required
          />
        </label>

        <label className="block">
          <span className="mb-2 block text-sm font-medium text-slate-700">Password</span>
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
          <span className="mb-2 block text-sm font-medium text-slate-700">Confirm Password</span>
          <input
            type="password"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none ring-slate-900 transition focus:ring-2"
            autoComplete="new-password"
            required
          />
        </label>

        {errorText ? <p className="text-sm text-red-600">{errorText}</p> : null}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? "Creating account..." : "Signup"}
        </button>
      </form>

      <div className="mt-6 text-sm text-slate-600">
        <Link href="/auth/login" className="underline underline-offset-4">
          Already have an account? Login
        </Link>
      </div>
    </main>
  );
};

SignupPage.auth = { guestOnly: true };

export default SignupPage;
