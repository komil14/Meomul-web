import Link from "next/link";
import { Instagram, Linkedin, Twitter } from "lucide-react";

const EXPLORE_LINKS = [
  { label: "Browse Hotels", href: "/hotels" },
  { label: "Last-Minute Deals", href: "/hotels" },
  { label: "Editorial Guides", href: "/" },
  { label: "Memberships", href: "/" },
];

const ACCOUNT_LINKS = [
  { label: "Sign In", href: "/auth/login" },
  { label: "Create Account", href: "/auth/signup" },
  { label: "My Bookings", href: "/bookings" },
  { label: "Profile Settings", href: "/profile" },
];

const COMPANY_LINKS = [
  { label: "About Meomul", href: "#" },
  { label: "Contact & Support", href: "#" },
  { label: "Privacy Policy", href: "#" },
  { label: "Terms of Service", href: "#" },
];

interface FooterColumnProps {
  title: string;
  links: { label: string; href: string }[];
}

function FooterColumn({ title, links }: FooterColumnProps) {
  return (
    <div>
      <h3 className="text-xs font-semibold text-white uppercase tracking-wider">{title}</h3>
      <ul className="mt-4 space-y-3">
        {links.map((link) => (
          <li key={link.label}>
            <Link
              href={link.href}
              className="text-sm text-slate-400 hover:text-white transition-colors"
            >
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function Footer() {
  return (
    <footer className="bg-slate-900 border-t border-slate-800">
      <div className="mx-auto max-w-6xl px-3 sm:px-6 py-14 sm:py-16">
        <div className="grid grid-cols-2 gap-10 lg:grid-cols-4">
          {/* Brand column — spans full width on mobile */}
          <div className="col-span-2 lg:col-span-1">
            <span className="text-white font-bold tracking-[0.18em] uppercase text-sm">
              MEOMUL
            </span>
            <p className="mt-3 text-sm text-slate-400 leading-relaxed max-w-xs">
              Find, compare and book hotels — built for guests who decide fast.
            </p>
            <div className="mt-6 flex gap-4">
              <a
                href="#"
                aria-label="Twitter"
                className="text-slate-500 hover:text-teal-400 transition-colors"
              >
                <Twitter size={18} />
              </a>
              <a
                href="#"
                aria-label="Instagram"
                className="text-slate-500 hover:text-teal-400 transition-colors"
              >
                <Instagram size={18} />
              </a>
              <a
                href="#"
                aria-label="LinkedIn"
                className="text-slate-500 hover:text-teal-400 transition-colors"
              >
                <Linkedin size={18} />
              </a>
            </div>
          </div>

          <FooterColumn title="Explore" links={EXPLORE_LINKS} />
          <FooterColumn title="Account" links={ACCOUNT_LINKS} />
          <FooterColumn title="Company" links={COMPANY_LINKS} />
        </div>

        <div className="mt-12 pt-6 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-xs text-slate-500">© 2026 Meomul. All rights reserved.</p>
          <div className="flex gap-4 text-xs text-slate-500">
            <a href="#" className="hover:text-slate-300 transition-colors">
              Privacy
            </a>
            <a href="#" className="hover:text-slate-300 transition-colors">
              Terms
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
