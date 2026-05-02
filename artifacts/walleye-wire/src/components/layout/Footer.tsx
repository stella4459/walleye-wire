import { Link } from "wouter";

export function Footer() {
  return (
    <footer className="bg-nav w-full py-10 text-center">
      <Link href="/" className="inline-block">
        <span className="font-masthead text-3xl sm:text-4xl text-white font-bold tracking-wide">
          THE WALLEYE WIRE
        </span>
      </Link>

      <div className="mt-5 flex items-center justify-center gap-2 font-mono text-[11px] tracking-wider text-white/60">
        <Link href="/terms" className="hover:text-white transition-colors">Terms of Use</Link>
        <span className="text-white/30">&middot;</span>
        <Link href="/terms" className="hover:text-white transition-colors">AI Disclaimer</Link>
        <span className="text-white/30">&middot;</span>
        <Link href="/terms" className="hover:text-white transition-colors">About</Link>
      </div>

      <hr className="mt-6 border-white/15 max-w-xs mx-auto" />

      <p className="mt-5 font-mono text-[10px] tracking-[0.25em] uppercase text-white/35">
        AI-Generated Content
      </p>
    </footer>
  );
}
