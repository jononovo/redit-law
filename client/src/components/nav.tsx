import { Button } from "@/components/ui/button";
import { Link } from "wouter";

export function Nav() {
  return (
    <nav className="fixed top-0 w-full z-50 bg-white/80 backdrop-blur-md border-b border-neutral-100">
      <div className="container mx-auto px-6 h-20 flex items-center justify-between">
        <Link href="/" className="group cursor-pointer flex items-center gap-2">
          <span className="text-2xl">🦞</span>
          <span className="font-sans font-bold text-xl tracking-tight text-neutral-900">
            CreditClaw
          </span>
        </Link>

        <div className="hidden md:flex items-center gap-8 text-sm font-semibold text-neutral-500">
          <a href="#how-it-works" className="hover:text-primary transition-colors">How it Works</a>
          <a href="#allowance" className="hover:text-primary transition-colors">Allowance</a>
          <a href="#safety" className="hover:text-primary transition-colors">Safety</a>
        </div>

        <div className="flex items-center gap-4">
          <Button variant="ghost" className="hidden md:flex font-bold text-neutral-600 hover:bg-neutral-50">
            Log in
          </Button>
          <Button className="rounded-full h-10 px-6 bg-primary text-white hover:bg-primary/90 font-bold shadow-lg shadow-primary/20">
            Sign Up
          </Button>
        </div>
      </div>
    </nav>
  );
}