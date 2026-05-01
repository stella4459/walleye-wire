import { ReactNode } from "react";
import { Navbar } from "./Navbar";
import { Footer } from "./Footer";

interface LayoutProps {
  children: ReactNode;
}

export function Layout({ children }: LayoutProps) {
  return (
    <div className="min-h-[100dvh] flex flex-col w-full">
      <Navbar />
      <main className="flex-grow flex flex-col relative w-full">
        {children}
      </main>
      <Footer />
    </div>
  );
}
