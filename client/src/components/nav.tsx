import { Button } from "@/components/ui/button";
import { Link } from "wouter";

export function Nav() {
  return (
    <nav className="fixed top-0 w-full z-50 bg-background/80 backdrop-blur-md border-b border-white/5">
      <div className="container mx-auto px-6 h-20 flex items-center justify-between">
        <Link href="/" className="group cursor-pointer">
          <span className="font-sans font-semibold tracking-tight text-lg">
            CreditClaw
          </span>
        </Link>

        <div className="hidden md:flex items-center gap-10 text-sm font-medium text-muted-foreground">
          <a href="#how-it-works" className="hover:text-white transition-colors">How it Works</a>
          <a href="#security" className="hover:text-white transition-colors">Security</a>
          <a href="#pricing" className="hover:text-white transition-colors">Pricing</a>
        </div>

        <div className="flex items-center gap-4">
          <Button variant="ghost" className="hidden md:flex text-sm font-medium hover:bg-white/5 hover:text-white">
            Log in
          </Button>
          <Button className="rounded-full h-10 px-6 bg-white text-black hover:bg-neutral-200 font-medium text-sm">
            Get Started
          </Button>
        </div>
      </div>
    </nav>
  );
}