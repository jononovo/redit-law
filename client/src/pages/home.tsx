import { Nav } from "@/components/nav";
import { Hero } from "@/components/hero";
import { Features } from "@/components/features";
import { WaitlistForm } from "@/components/waitlist-form";

export default function Home() {
  return (
    <div className="min-h-screen bg-black text-white font-sans selection:bg-[hsl(var(--accent))] selection:text-black">
      <Nav />
      <main>
        <Hero />
        <Features />
        <WaitlistForm />
      </main>
    </div>
  );
}