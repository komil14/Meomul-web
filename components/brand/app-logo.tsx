import Image from "next/image";
import Link from "next/link";

interface AppLogoProps {
  href?: string;
  className?: string;
  inverted?: boolean;
  compact?: boolean;
}

export function AppLogo({
  href = "/",
  className = "",
  inverted = false,
  compact = false,
}: AppLogoProps) {
  const textColor = inverted ? "text-white" : "text-slate-950";
  const markSize = compact ? 36 : 44;

  return (
    <Link href={href} className={`inline-flex items-center gap-3 no-underline ${className}`}>
      <span
        className="relative inline-flex shrink-0 items-center justify-center overflow-hidden"
        style={{ width: markSize, height: markSize }}
        aria-hidden="true"
      >
        <Image
          src="/brand/meomul-mark-pin.svg"
          alt=""
          width={markSize}
          height={markSize}
          className="h-full w-full object-contain"
        />
      </span>
      <span className={`leading-none ${textColor}`}>
        <span
          className={`block font-semibold tracking-[0.22em] ${
            compact ? "text-[0.98rem]" : "text-[1.05rem]"
          }`}
        >
          MEOMUL
        </span>
      </span>
    </Link>
  );
}
