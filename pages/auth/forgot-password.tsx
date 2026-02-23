import Link from "next/link";
import { useState } from "react";
import { ErrorNotice } from "@/components/ui/error-notice";
import type { NextPageWithAuth } from "@/types/page";

const ForgotPasswordPage: NextPageWithAuth = () => {
  const [identifier, setIdentifier] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const onSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitted(true);
  };

  return (
    <main className="mx-auto flex w-full max-w-md flex-col justify-center">
      <h1 className="text-3xl font-semibold text-slate-900">Forgot Password</h1>
      <ErrorNotice
        className="mt-3"
        tone="info"
        message="Backend reset-password API is not ready yet. This flow is currently a frontend placeholder."
      />

      <form className="mt-8 space-y-4 rounded-2xl border border-slate-200 bg-white p-6" onSubmit={onSubmit}>
        <label className="block">
          <span className="mb-2 block text-sm font-medium text-slate-700">Member Nick or Phone</span>
          <input
            value={identifier}
            onChange={(event) => setIdentifier(event.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none ring-slate-900 transition focus:ring-2"
            required
          />
        </label>

        <button
          type="submit"
          className="w-full rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-700"
        >
          Send reset request
        </button>
      </form>

      {submitted ? (
        <ErrorNotice
          className="mt-4"
          tone="warn"
          message="Request captured in UI. Connect this page when backend password-reset mutations are available."
        />
      ) : null}

      <div className="mt-6 text-sm text-slate-600">
        <Link href="/auth/login" className="underline underline-offset-4">
          Back to login
        </Link>
      </div>
    </main>
  );
};

ForgotPasswordPage.auth = { guestOnly: true };

export default ForgotPasswordPage;
