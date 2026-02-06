import { motion } from "framer-motion";

const specs = [
  {
    label: "Latency",
    value: "< 50ms",
    desc: "Global edge network transaction processing."
  },
  {
    label: "Security",
    value: "AES-256",
    desc: "Military-grade encryption for all token data."
  },
  {
    label: "Uptime",
    value: "99.99%",
    desc: "Redundant architecture across 3 continents."
  }
];

export function Features() {
  return (
    <section id="features" className="py-32 bg-black text-white border-t border-white/5">
      <div className="container mx-auto px-6">
        
        <div className="grid lg:grid-cols-2 gap-24 mb-32">
            <div>
                <h2 className="text-3xl font-light tracking-tight mb-8">
                    Engineered for <span className="text-[hsl(var(--accent))]">Autonomy</span>.
                </h2>
            </div>
            <div className="space-y-8">
                <p className="text-neutral-400 font-light leading-relaxed">
                    Traditional payment rails were built for humans with wallets. 
                    CreditClaw is built for code. We provide the primitive financial layer 
                    for autonomous agents to transact, budget, and settle value without human intervention.
                </p>
                <ul className="grid grid-cols-2 gap-y-4 font-mono text-xs text-neutral-500 uppercase tracking-wide">
                    <li className="flex items-center gap-2"><div className="w-1 h-1 bg-[hsl(var(--accent))]" /> REST API Access</li>
                    <li className="flex items-center gap-2"><div className="w-1 h-1 bg-[hsl(var(--accent))]" /> Real-time Webhooks</li>
                    <li className="flex items-center gap-2"><div className="w-1 h-1 bg-[hsl(var(--accent))]" /> scoped keys</li>
                    <li className="flex items-center gap-2"><div className="w-1 h-1 bg-[hsl(var(--accent))]" /> Spend Limits</li>
                </ul>
            </div>
        </div>

        <div className="grid md:grid-cols-3 border-t border-white/10">
          {specs.map((spec, index) => (
            <div key={index} className="pt-8 md:pt-12 md:pr-12 group">
              <div className="font-mono text-[10px] uppercase tracking-widest text-neutral-500 mb-4 group-hover:text-[hsl(var(--accent))] transition-colors">
                0{index + 1} / {spec.label}
              </div>
              <div className="text-4xl font-light tracking-tighter mb-2">{spec.value}</div>
              <div className="text-sm text-neutral-400 font-light">{spec.desc}</div>
            </div>
          ))}
        </div>

      </div>
    </section>
  );
}