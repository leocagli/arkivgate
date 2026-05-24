import Link from "next/link";

import { BrandMark } from "@/components/brand-mark";
import { WalletIdentityButton } from "./wallet-identity-button";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-30 w-full border-b border-graphite-dark/15 bg-paper/85 backdrop-blur supports-[backdrop-filter]:bg-paper/70">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <Wordmark />
        <nav className="hidden items-center gap-8 font-mono text-xs uppercase tracking-wide text-graphite md:flex">
          <Link href="/#producto" className="transition-colors hover:text-ink">
            producto
          </Link>
          <Link href="/#flujo" className="transition-colors hover:text-ink">
            flujo
          </Link>
          <Link href="/#arquitectura" className="transition-colors hover:text-ink">
            arquitectura
          </Link>
          <Link href="/#roadmap" className="transition-colors hover:text-ink">
            roadmap
          </Link>
        </nav>
        <div className="flex items-center gap-4">
          <WalletIdentityButton compact />
          <Link
            href="/admin/login"
            className="inline-flex items-center bg-ink px-4 py-2 font-mono text-xs uppercase tracking-wider text-paper transition-colors hover:bg-graphite-dark"
            style={{ borderRadius: "var(--radius)" }}
          >
            login →
          </Link>
        </div>
      </div>
    </header>
  );
}

export function Wordmark({ size = "sm" }: { size?: "sm" | "lg" }) {
  const wordSize = size === "lg" ? "text-6xl md:text-8xl" : "text-xl";
  return (
    <Link href="/" className="flex items-center gap-3" aria-label="ArkivGate home">
      <BrandMark
        decorative
        className={`${size === "lg" ? "h-14 w-14 md:h-20 md:w-20" : "h-6 w-6"} text-ink`}
      />
      <span
        className={`${wordSize} font-sans font-semibold lowercase tracking-tight text-ink`}
      >
        arkivgate
      </span>
    </Link>
  );
}
