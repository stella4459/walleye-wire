import { Link, useLocation } from "wouter";
import { Menu, X } from "lucide-react";
import { useState } from "react";
import { Ticker } from "@/components/shared/Ticker";

export function Navbar() {
  const [location] = useLocation();
  const [isOpen, setIsOpen] = useState(false);

  const links = [
    { href: "/", label: "Home" },
    { href: "/community", label: "Community" },
    { href: "/government", label: "Local Government" },
    { href: "/calendar", label: "Calendar" },
    { href: "/weather", label: "Weather" },
  ];

  const isActive = (href: string) => location === href;

  return (
    <header className="w-full">
      {/* Masthead */}
      <div className="bg-primary w-full py-6 px-4 text-center">
        <Link href="/">
          <h1 className="font-masthead text-4xl sm:text-5xl md:text-6xl text-white font-bold tracking-wide leading-tight">
            THE WALLEYE WIRE
          </h1>
          <p className="font-serif italic text-white/85 text-base sm:text-lg mt-1">
            Your source for everything Port Clinton
          </p>
        </Link>
      </div>

      {/* Nav bar */}
      <nav className="bg-nav w-full">
        {/* Desktop nav */}
        <div className="hidden md:flex items-stretch flex-wrap">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`font-mono text-xs font-medium tracking-widest uppercase px-5 py-3 transition-colors ${
                isActive(link.href)
                  ? "bg-primary text-white"
                  : "text-white/80 hover:text-white hover:bg-white/10"
              }`}
            >
              {link.label}
            </Link>
          ))}
        </div>

        {/* Mobile nav */}
        <div className="md:hidden flex items-center justify-between px-4 py-3">
          <span className="font-mono text-xs tracking-widest uppercase text-white/60">
            {links.find((l) => isActive(l.href))?.label ?? "Menu"}
          </span>
          <button
            onClick={() => setIsOpen(!isOpen)}
            className="text-white p-1"
            aria-label="Toggle menu"
          >
            {isOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>

        {isOpen && (
          <div className="md:hidden border-t border-white/10">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setIsOpen(false)}
                className={`block font-mono text-xs tracking-widest uppercase px-5 py-3 ${
                  isActive(link.href)
                    ? "bg-primary text-white"
                    : "text-white/80 hover:bg-white/10 hover:text-white"
                }`}
              >
                {link.label}
              </Link>
            ))}
          </div>
        )}
      </nav>

      {/* LATEST ticker bar */}
      <Ticker />
    </header>
  );
}
