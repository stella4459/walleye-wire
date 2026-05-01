import { Link } from "wouter";

export function Footer() {
  const currentYear = new Date().getFullYear();
  
  return (
    <footer className="border-t border-border bg-card mt-auto">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div>
            <Link href="/" className="font-headline text-3xl font-bold tracking-wider text-primary">
              THE WALLEYE WIRE
            </Link>
            <p className="mt-4 text-sm text-muted-foreground font-sans max-w-xs leading-relaxed">
              Independent, AI-powered local news for Port Clinton, Ohio and Ottawa County. Delivered with Lake Erie grit.
            </p>
          </div>
          
          <div>
            <h3 className="font-sans font-bold text-sm tracking-widest uppercase mb-4 text-foreground">Sections</h3>
            <ul className="space-y-2 font-serif text-sm">
              <li><Link href="/community" className="text-muted-foreground hover:text-primary transition-colors">Community & General</Link></li>
              <li><Link href="/government" className="text-muted-foreground hover:text-primary transition-colors">Local Government</Link></li>
              <li><Link href="/calendar" className="text-muted-foreground hover:text-primary transition-colors">Community Calendar</Link></li>
              <li><Link href="/weather" className="text-muted-foreground hover:text-primary transition-colors">Weather Forecast</Link></li>
            </ul>
          </div>
          
          <div>
            <h3 className="font-sans font-bold text-sm tracking-widest uppercase mb-4 text-foreground">Information</h3>
            <ul className="space-y-2 font-serif text-sm">
              <li><Link href="/terms" className="text-muted-foreground hover:text-primary transition-colors">About & Terms of Use</Link></li>
              <li><Link href="/admin" className="text-muted-foreground hover:text-primary transition-colors">Admin Login</Link></li>
            </ul>
          </div>
        </div>
        
        <div className="mt-12 pt-8 border-t border-border flex flex-col md:flex-row justify-between items-center">
          <p className="text-xs text-muted-foreground font-mono">
            &copy; {currentYear} The Walleye Wire. All rights reserved.
          </p>
          <p className="text-xs text-muted-foreground font-mono mt-2 md:mt-0">
            Port Clinton, Ohio
          </p>
        </div>
      </div>
    </footer>
  );
}
