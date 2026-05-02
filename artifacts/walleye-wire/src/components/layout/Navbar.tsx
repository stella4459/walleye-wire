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
  const currentLabel = links.find((l) => isActive(l.href))?.label ?? "Menu";

  return (
    <header role="banner">
      {/* Masthead */}
      <div className="bg-primary w-full py-6 px-4 text-center">
        <Link href="/" aria-label="The Walleye Wire — home">
          <p
            className="font-masthead text-4xl sm:text-5xl md:text-6xl text-white font-bold tracking-wide leading-tight"
            aria-hidden="true"
          >
            THE WALLEYE WIRE
          </p>
          <p className="font-serif italic text-white text-base sm:text-lg mt-1">
            Your source for everything Port Clinton
          </p>
        </Link>
      </div>

      {/* Nav bar */}
      <nav aria-label="Main navigation" className="bg-nav w-full">
        {/* Desktop nav */}
        <ul className="hidden md:flex items-stretch flex-wrap list-none m-0 p-0">
          {links.map((link) => (
            <li key={link.href}>
              <Link
                href={link.href}
                aria-current={isActive(link.href) ? "page" : undefined}
                className={`block font-mono text-xs font-medium tracking-widest uppercase px-5 py-3 transition-colors focus-visible:outline-offset-0 ${
                  isActive(link.href)
                    ? "bg-primary text-white"
                    : "text-white hover:text-white hover:bg-white/10"
                }`}
              >
                {link.label}
              </Link>
            </li>
          ))}
        </ul>

        {/* Mobile nav toggle */}
        <div className="md:hidden flex items-center justify-between px-4 py-3">
          <span className="font-mono text-xs tracking-widest uppercase text-white" aria-hidden="true">
            {currentLabel}
          </span>
          <button
            onClick={() => setIsOpen(!isOpen)}
            className="text-white p-1 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
            aria-label={isOpen ? "Close navigation menu" : "Open navigation menu"}
            aria-expanded={isOpen}
            aria-controls="mobile-nav"
          >
            {isOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>

        {isOpen && (
          <ul id="mobile-nav" className="md:hidden border-t border-white/10 list-none m-0 p-0">
            {links.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  onClick={() => setIsOpen(false)}
                  aria-current={isActive(link.href) ? "page" : undefined}
                  className={`block font-mono text-xs tracking-widest uppercase px-5 py-3 ${
                    isActive(link.href)
                      ? "bg-primary text-white"
                      : "text-white hover:bg-white/10 hover:text-white"
                  }`}
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </nav>

      {/* LATEST ticker bar */}
      <Ticker />
    </header>
  );
}
