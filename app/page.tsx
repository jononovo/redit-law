import { Nav } from "@/components/nav";
import { Hero } from "@/components/hero";
import { LiveMetrics } from "@/components/live-metrics";
import { Features } from "@/components/features";
import { WaitlistForm } from "@/components/waitlist-form";

export default function Home() {
  return (
    <div className="min-h-screen bg-background text-neutral-900 font-sans selection:bg-[hsl(var(--accent))] selection:text-black">
      <Nav />
      <main>
        <Hero />
        <LiveMetrics />
        <Features />
        <WaitlistForm />
      </main>
    </div>
  );
}
