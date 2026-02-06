import { motion } from "framer-motion";

const specs = [
  {
    label: "Native Skill",
    value: "npm i @creditclaw/skill",
    desc: "One-line install for your OpenClaw agent."
  },
  {
    label: "Limits",
    value: "Hard Capped",
    desc: "Strict daily spend limits per agent instance."
  },
  {
    label: "Moltbook",
    value: "Verified",
    desc: "Get the 'Verified Payer' badge on Moltbook."
  }
];

export function Features() {
  return (
    <section id="features" className="py-32 bg-black text-white border-t border-white/5">
      <div className="container mx-auto px-6">
        
        <div className="grid lg:grid-cols-2 gap-24 mb-32">
            <div>
                <h2 className="text-3xl font-light tracking-tight mb-8">
                    Business Ops for <span className="text-[hsl(var(--accent))]">Bots</span>.
                </h2>
            </div>
            <div className="space-y-8">
                <p className="text-neutral-400 font-light leading-relaxed">
                    Your OpenClaw agent is smart, but it's broke. It can navigate the web, fill forms, and negotiate, 
                    but it hits a wall at checkout. CreditClaw gives your bot a secure, prepaid card to pay for 
                    SaaS subscriptions, API credits, and business expenses autonomously.
                </p>
                <ul className="grid grid-cols-2 gap-y-4 font-mono text-xs text-neutral-500 uppercase tracking-wide">
                    <li className="flex items-center gap-2"><div className="w-1 h-1 bg-[hsl(var(--accent))]" /> OpenClaw Compatible</li>
                    <li className="flex items-center gap-2"><div className="w-1 h-1 bg-[hsl(var(--accent))]" /> Merchant Whitelisting</li>
                    <li className="flex items-center gap-2"><div className="w-1 h-1 bg-[hsl(var(--accent))]" /> Single-Use Numbers</li>
                    <li className="flex items-center gap-2"><div className="w-1 h-1 bg-[hsl(var(--accent))]" /> Auto-Receipt Match</li>
                </ul>
            </div>
        </div>

        <div className="grid md:grid-cols-3 border-t border-white/10">
          {specs.map((spec, index) => (
            <div key={index} className="pt-8 md:pt-12 md:pr-12 group">
              <div className="font-mono text-[10px] uppercase tracking-widest text-neutral-500 mb-4 group-hover:text-[hsl(var(--accent))] transition-colors">
                0{index + 1} / {spec.label}
              </div>
              <div className="text-xl md:text-2xl font-light tracking-tighter mb-2 font-mono">{spec.value}</div>
              <div className="text-sm text-neutral-400 font-light">{spec.desc}</div>
            </div>
          ))}
        </div>

      </div>
    </section>
  );
}