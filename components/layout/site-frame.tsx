import Link from "next/link";
import { useRouter } from "next/router";
import type { PropsWithChildren } from "react";

const links = [
  { href: "/", label: "Home" },
  { href: "/auth/login", label: "Login" },
  { href: "/auth/signup", label: "Signup" },
  { href: "/dashboard", label: "Dashboard" },
] as const;

const isActive = (pathname: string, href: string): boolean => {
  if (href === "/") {
    return pathname === "/";
  }

  return pathname === href || pathname.startsWith(`${href}/`);
};

export function SiteFrame({ children }: PropsWithChildren) {
  const router = useRouter();

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-10 border-b border-white/50 bg-white/70 backdrop-blur">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-4">
          <Link href="/" className="font-display text-lg font-semibold tracking-[0.12em] text-slate-800">
            MEOMUL
          </Link>
          <nav className="flex flex-wrap items-center gap-1">
            {links.map((link) => {
              const active = isActive(router.pathname, link.href);

              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
                    active ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                  }`}
                >
                  {link.label}
                </Link>
              );
            })}
          </nav>
        </div>
      </header>
      <div className="mx-auto w-full max-w-6xl px-6 py-10">{children}</div>
    </div>
  );
}
