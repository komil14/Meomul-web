import Head from "next/head";
import Link from "next/link";
import {
  CalendarClock,
  Handshake,
  Headset,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { useI18n } from "@/lib/i18n/provider";

const SERVICE_ITEMS = [
  {
    icon: CalendarClock,
    keyTitle: "about_service_realtime_title",
    keyDesc: "about_service_realtime_desc",
  },
  {
    icon: ShieldCheck,
    keyTitle: "about_service_verified_title",
    keyDesc: "about_service_verified_desc",
  },
  {
    icon: Sparkles,
    keyTitle: "about_service_flexible_title",
    keyDesc: "about_service_flexible_desc",
  },
  {
    icon: Headset,
    keyTitle: "about_service_support_title",
    keyDesc: "about_service_support_desc",
  },
] as const;

const FEATURE_ITEMS = [
  {
    keyTitle: "about_featured_card_booking_title",
    keyDesc: "about_featured_card_booking_desc",
  },
  {
    keyTitle: "about_featured_card_quality_title",
    keyDesc: "about_featured_card_quality_desc",
  },
  {
    keyTitle: "about_featured_card_security_title",
    keyDesc: "about_featured_card_security_desc",
  },
] as const;

const PROCESS_ITEMS = [
  {
    keyTitle: "about_process_discover_title",
    keyDesc: "about_process_discover_desc",
  },
  {
    keyTitle: "about_process_plan_title",
    keyDesc: "about_process_plan_desc",
  },
  {
    keyTitle: "about_process_lock_title",
    keyDesc: "about_process_lock_desc",
  },
  {
    keyTitle: "about_process_book_title",
    keyDesc: "about_process_book_desc",
  },
] as const;

export default function AboutPage() {
  const { t } = useI18n();

  return (
    <>
      <Head>
        <title>{t("about_meta_title")}</title>
        <meta name="description" content={t("about_meta_desc")} />
      </Head>

      <main className="bg-white text-slate-900">
        <section className="relative overflow-hidden border-b border-slate-100 bg-slate-950 py-20 text-white sm:py-24">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.18),transparent_45%),radial-gradient(circle_at_bottom_right,rgba(45,212,191,0.16),transparent_45%)] opacity-70" />
          <div className="relative mx-auto max-w-6xl px-4 sm:px-6">
            <p className="mb-4 inline-flex rounded-full border border-white/25 px-4 py-1 text-[11px] font-semibold uppercase tracking-[0.15em] text-white/90">
              {t("about_hero_badge")}
            </p>
            <h1 className="max-w-4xl text-4xl font-semibold leading-tight tracking-tight md:text-6xl">
              {t("about_hero_title")}
            </h1>
            <p className="mt-6 max-w-2xl text-base text-white/90 md:text-xl">
              {t("about_hero_desc")}
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="/hotels"
                className="rounded-full bg-white px-6 py-2.5 text-sm font-semibold text-slate-900 transition hover:bg-white/90"
              >
                {t("about_hero_cta_browse")}
              </Link>
              <a
                href="#contact"
                className="rounded-full border border-white/40 px-6 py-2.5 text-sm font-semibold transition hover:border-white/80 hover:bg-white/10"
              >
                {t("about_hero_cta_contact")}
              </a>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
          <p className="text-sm font-semibold uppercase tracking-[0.15em] text-slate-500">
            {t("about_services_eyebrow")}
          </p>
          <div className="mt-3 flex flex-col gap-2 sm:gap-4 lg:flex-row lg:items-end lg:justify-between">
            <h2 className="max-w-2xl text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">
              {t("about_services_title")}
            </h2>
            <p className="max-w-xl text-sm text-slate-600 sm:text-base">
              {t("about_services_desc")}
            </p>
          </div>

          <div className="mt-10 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {SERVICE_ITEMS.map((item) => {
              const Icon = item.icon;
              return (
                <article
                  key={item.keyTitle}
                  className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-md"
                >
                  <div className="mb-4 inline-flex rounded-2xl bg-slate-100 p-2 text-slate-700">
                    <Icon size={18} />
                  </div>
                  <h3 className="text-lg font-semibold">{t(item.keyTitle)}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-slate-600">
                    {t(item.keyDesc)}
                  </p>
                </article>
              );
            })}
          </div>
        </section>

        <section className="border-y border-slate-100 bg-slate-50">
          <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
            <p className="text-sm font-semibold uppercase tracking-[0.15em] text-slate-500">
              {t("about_featured_eyebrow")}
            </p>
            <div className="mt-3 flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between">
              <h2 className="max-w-2xl text-3xl font-semibold tracking-tight sm:text-4xl">
                {t("about_featured_title")}
              </h2>
              <p className="max-w-xl text-sm text-slate-600 sm:text-base">
                {t("about_featured_desc")}
              </p>
            </div>

            <div className="mt-10 grid gap-4 md:grid-cols-3">
              {FEATURE_ITEMS.map((item) => (
                <article
                  key={item.keyTitle}
                  className="rounded-3xl border border-slate-200 bg-white p-6 transition hover:-translate-y-1 hover:border-slate-300"
                >
                  <h3 className="text-xl font-semibold">
                    {t(item.keyTitle)}
                  </h3>
                  <p className="mt-2 text-sm text-slate-600">{t(item.keyDesc)}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
          <p className="text-sm font-semibold uppercase tracking-[0.15em] text-slate-500">
            {t("about_process_eyebrow")}
          </p>
          <div className="mt-3 flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between">
            <h2 className="max-w-2xl text-3xl font-semibold tracking-tight sm:text-4xl">
              {t("about_process_title")}
            </h2>
            <p className="max-w-xl text-sm text-slate-600 sm:text-base">
              {t("about_process_desc")}
            </p>
          </div>

          <ol className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {PROCESS_ITEMS.map((item, index) => (
              <li
                key={item.keyTitle}
                className="rounded-3xl border border-slate-200 bg-white p-6"
              >
                <div className="mb-3 inline-flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-sm font-semibold text-slate-700">
                  {index + 1}
                </div>
                <h3 className="text-lg font-semibold">{t(item.keyTitle)}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">
                  {t(item.keyDesc)}
                </p>
              </li>
            ))}
          </ol>
        </section>

        <section id="contact" className="bg-slate-900 py-16 sm:py-20">
          <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 text-white sm:flex-row sm:items-end sm:justify-between sm:px-6">
            <div className="max-w-2xl">
              <p className="text-sm font-semibold uppercase tracking-[0.15em] text-white/70">
                {t("about_contact_eyebrow")}
              </p>
              <h2 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
                {t("about_contact_title")}
              </h2>
              <p className="mt-4 max-w-xl text-sm text-white/80 sm:text-base">
                {t("about_contact_desc")}
              </p>
            </div>
            <div className="space-y-3">
              <div className="text-sm text-white/80">{t("about_contact_email")}</div>
              <div className="flex items-center gap-2">
                <Handshake size={18} className="text-teal-300" />
                <span className="text-sm font-semibold">
                  {t("about_contact_open")}
                </span>
              </div>
            </div>
          </div>
        </section>
      </main>
    </>
  );
}
