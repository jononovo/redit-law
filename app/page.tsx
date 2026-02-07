import { Nav } from "@/components/nav";
import { Hero } from "@/components/hero";
import { LiveMetrics } from "@/components/live-metrics";
import { Features } from "@/components/features";
import { WaitlistForm } from "@/components/waitlist-form";
import { AnnouncementBar } from "@/components/announcement-bar";

export default function Home() {
  return (
    <div className="min-h-screen bg-background text-neutral-900 font-sans selection:bg-[hsl(var(--accent))] selection:text-black">
      <AnnouncementBar />
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
