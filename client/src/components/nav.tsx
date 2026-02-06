import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { Terminal } from "lucide-react";

export function Nav() {
  return (
    <nav className="fixed top-0 w-full z-50 bg-background/80 backdrop-blur-md border-b border-white/10">
      <div className="container mx-auto px-4 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2 group cursor-pointer">
          <div className="p-2 rounded bg-primary/20 text-primary group-hover:bg-primary/30 transition-colors">
            <Terminal size={20} />
          </div>
          <span className="font-mono font-bold text-lg tracking-tighter">
            SECURE<span className="text-primary">CLAW</span>HUB
          </span>
        </Link>

        <div className="hidden md:flex items-center gap-8 text-sm font-medium text-muted-foreground">
          <a href="#features" className="hover:text-primary transition-colors">Features</a>
          <a href="#bots" className="hover:text-primary transition-colors">For Bots</a>
          <a href="#humans" className="hover:text-primary transition-colors">For Humans</a>
        </div>

        <Button variant="outline" className="border-primary/50 text-primary hover:bg-primary/10 hover:text-primary font-mono">
          JOIN_WAITLIST
        </Button>
      </div>
    </nav>
  );
}