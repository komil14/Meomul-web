import Link from "next/link";
import { Mail } from "lucide-react";
import type { NextPageWithAuth } from "@/types/page";

const ForgotPasswordPage: NextPageWithAuth = () => {
  return (
    <main className="mx-auto flex w-full max-w-md flex-col justify-center">
      <h1 className="text-3xl font-semibold text-slate-900">Forgot Password</h1>
      <p className="mt-2 text-sm text-slate-500">
        Password reset via email is not yet available on this platform.
      </p>

      <div className="mt-8 rounded-2xl border border-slate-200 bg-white p-6">
        <div className="flex items-start gap-4">
          <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-sky-50">
            <Mail size={18} className="text-sky-500" />
          </div>
          <div>
            <p className="font-medium text-slate-900">Contact support</p>
            <p className="mt-1 text-sm text-slate-500">
              To reset your password, please reach out to our support team from
              the{" "}
              <Link href="/support" className="text-sky-600 underline underline-offset-4 hover:text-sky-700">
                support page
              </Link>
              . Include your registered phone number and we will assist you
              promptly.
            </p>
          </div>
        </div>
      </div>

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
