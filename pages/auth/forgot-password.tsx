import Link from "next/link";
import { Mail } from "lucide-react";
import { useI18n } from "@/lib/i18n/provider";
import type { NextPageWithAuth } from "@/types/page";

const ForgotPasswordPage: NextPageWithAuth = () => {
  const { t } = useI18n();
  return (
    <main className="flex w-full flex-col justify-center">
      <h1 className="text-3xl font-semibold text-slate-900">{t("auth_forgot_title")}</h1>
      <p className="mt-2 text-sm text-slate-500">
        {t("auth_forgot_desc")}
      </p>

      <div className="mt-8 rounded-2xl border border-slate-200 bg-white p-6">
        <div className="flex items-start gap-4">
          <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-sky-50">
            <Mail size={18} className="text-sky-500" />
          </div>
          <div>
            <p className="font-medium text-slate-900">{t("auth_forgot_card_title")}</p>
            <p className="mt-1 text-sm text-slate-500">
              {t("auth_forgot_card_body_before_link")}{" "}
              <Link href="/support" className="text-sky-600 underline underline-offset-4 hover:text-sky-700">
                {t("nav_support").toLowerCase()}
              </Link>
              . {t("auth_forgot_card_body_after_link")}
            </p>
          </div>
        </div>
      </div>

      <div className="mt-6 text-sm text-slate-600">
        <Link href="/auth/login" className="underline underline-offset-4">
          {t("auth_back_to_login")}
        </Link>
      </div>
    </main>
  );
};

ForgotPasswordPage.auth = { guestOnly: true };

export default ForgotPasswordPage;
