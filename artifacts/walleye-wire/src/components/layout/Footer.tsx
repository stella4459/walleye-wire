import { Link } from "wouter";

export function Footer() {
  return (
    <footer className="bg-nav w-full py-10 text-center" aria-label="Site footer">
      <Link href="/" aria-label="The Walleye Wire — home">
        <span className="font-masthead text-3xl sm:text-4xl text-white font-bold tracking-wide">
          THE WALLEYE WIRE
        </span>
      </Link>

      {/* Links — text-white/80 = ~12:1 contrast on #1a1a1a ✓ */}
      <nav aria-label="Footer navigation">
        <div className="mt-5 flex items-center justify-center gap-2 font-mono text-[11px] tracking-wider text-white">
          <Link href="/terms" className="text-white/80 hover:text-white transition-colors underline-offset-2 hover:underline">
            Terms of Use
          </Link>
          {/* decorative separator */}
          <span className="text-white/50" aria-hidden="true">&middot;</span>
          <Link href="/terms" className="text-white/80 hover:text-white transition-colors underline-offset-2 hover:underline">
            AI Disclaimer
          </Link>
          <span className="text-white/50" aria-hidden="true">&middot;</span>
          <Link href="/terms" className="text-white/80 hover:text-white transition-colors underline-offset-2 hover:underline">
            About
          </Link>
        </div>
      </nav>

      <hr className="mt-6 border-white/20 max-w-xs mx-auto" aria-hidden="true" />

      {/* text-white/65 = ~8:1 contrast on #1a1a1a ✓ */}
      <p className="mt-5 font-mono text-[11px] tracking-[0.25em] uppercase text-white/65">
        AI-Generated Content
      </p>
    </footer>
  );
}
