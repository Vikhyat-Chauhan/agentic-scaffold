import Link from "next/link";
import { SlidersHorizontal, Heart } from "lucide-react";

/** Editorial masthead. Sticky, glassy, with a hand-set serif wordmark. */
export function Header() {
  return (
    <header className="sticky top-0 z-40 border-b border-border/70 bg-canvas/70 backdrop-blur-xl">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4 sm:px-8">
        <Link href="/" className="group flex items-baseline gap-2.5">
          <span className="font-display text-2xl font-semibold tracking-tight text-text-primary">
            Afoot
          </span>
          <span className="hidden font-mono text-[10px] uppercase tracking-widest2 text-text-tertiary sm:inline">
            San Francisco
          </span>
        </Link>

        <nav className="flex items-center gap-2">
          <Link
            href="/saved"
            className="flex items-center gap-2 rounded-full border border-border bg-surface px-4 py-2 text-sm text-text-secondary transition-colors hover:border-border-2 hover:text-text-primary focus-visible:text-text-primary"
          >
            <Heart className="h-3.5 w-3.5" aria-hidden />
            <span>Saved</span>
          </Link>
          <Link
            href="/onboarding"
            className="flex items-center gap-2 rounded-full border border-border bg-surface px-4 py-2 text-sm text-text-secondary transition-colors hover:border-border-2 hover:text-text-primary focus-visible:text-text-primary"
          >
            <SlidersHorizontal className="h-3.5 w-3.5" aria-hidden />
            <span>Tune taste</span>
          </Link>
        </nav>
      </div>
    </header>
  );
}
