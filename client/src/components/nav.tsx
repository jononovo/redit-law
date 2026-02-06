import { Button } from "@/components/ui/button";
import { Link } from "wouter";

export function Nav() {
  return (
    <nav className="fixed top-0 w-full z-50 mix-blend-difference text-white">
      <div className="container mx-auto px-6 h-20 flex items-center justify-between">
        <Link href="/" className="group cursor-pointer">
          <span className="font-sans font-medium tracking-tight text-sm">
            CREDITCLAW<span className="text-[hsl(var(--accent))]">.</span>
          </span>
        </Link>

        <div className="hidden md:flex items-center gap-12 text-xs font-medium tracking-wide uppercase opacity-70">
          <a href="#features" className="hover:opacity-100 transition-opacity">Protocol</a>
          <a href="#bots" className="hover:opacity-100 transition-opacity">Integration</a>
          <a href="#about" className="hover:opacity-100 transition-opacity">Manifesto</a>
        </div>

        <Button variant="link" className="text-xs uppercase tracking-widest hover:no-underline hover:text-[hsl(var(--accent))] transition-colors p-0">
          Access_Terminal [↗]
        </Button>
      </div>
    </nav>
  );
}