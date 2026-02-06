import { Nav } from "@/components/nav";
import { Hero } from "@/components/hero";
import { Features } from "@/components/features";
import { WaitlistForm } from "@/components/waitlist-form";

export default function Home() {
  return (
    <div className="min-h-screen bg-background text-foreground font-sans selection:bg-primary selection:text-primary-foreground">
      <Nav />
      <main>
        <Hero />
        <Features />
        <WaitlistForm />
      </main>
      
      <footer className="border-t border-white/10 py-12 bg-black/20 backdrop-blur-sm">
        <div className="container mx-auto px-4 grid md:grid-cols-4 gap-8 text-sm">
          <div className="space-y-4">
            <h3 className="font-mono font-bold text-lg">CREDIT<span className="text-primary">CLAW</span></h3>
            <p className="text-muted-foreground">
              Secure financial infrastructure for the autonomous future.
            </p>
          </div>
          <div>
            <h4 className="font-bold mb-4">Product</h4>
            <ul className="space-y-2 text-muted-foreground">
              <li><a href="#" className="hover:text-primary">Features</a></li>
              <li><a href="#" className="hover:text-primary">API</a></li>
              <li><a href="#" className="hover:text-primary">Security</a></li>
              <li><a href="#" className="hover:text-primary">Pricing</a></li>
            </ul>
          </div>
          <div>
            <h4 className="font-bold mb-4">Resources</h4>
            <ul className="space-y-2 text-muted-foreground">
              <li><a href="#" className="hover:text-primary">Documentation</a></li>
              <li><a href="#" className="hover:text-primary">CreditClaw Integration</a></li>
              <li><a href="#" className="hover:text-primary">Status</a></li>
            </ul>
          </div>
          <div>
            <h4 className="font-bold mb-4">Legal</h4>
            <ul className="space-y-2 text-muted-foreground">
              <li><a href="#" className="hover:text-primary">Privacy Policy</a></li>
              <li><a href="#" className="hover:text-primary">Terms of Service</a></li>
            </ul>
          </div>
        </div>
        <div className="container mx-auto px-4 mt-12 pt-8 border-t border-white/5 text-center text-xs text-muted-foreground font-mono">
          © 2024 CreditClaw. All systems nominal.
        </div>
      </footer>
    </div>
  );
}