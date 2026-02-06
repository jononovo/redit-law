import { motion } from "framer-motion";
import { CreditCard, ShieldCheck, Zap, Receipt } from "lucide-react";

const features = [
  {
    icon: CreditCard,
    title: "Instant Virtual Cards",
    description: "Generate a unique card for every bot or vendor. Freeze or cancel instantly with one click."
  },
  {
    icon: ShieldCheck,
    title: "Hard Spend Limits",
    description: "Set daily, weekly, or monthly budgets. Your bots can never spend more than you authorize."
  },
  {
    icon: Zap,
    title: "OpenClaw Integration",
    description: "Built-in 'Pay' skill for OpenClaw. Just install the plugin and your agent is ready to shop."
  },
  {
    icon: Receipt,
    title: "Auto-Receipt Matching",
    description: "We automatically capture receipts and match them to transactions. Accounting, solved."
  }
];

export function Features() {
  return (
    <section id="how-it-works" className="py-32 bg-background border-t border-white/5">
      <div className="container mx-auto px-6">
        
        <div className="text-center max-w-3xl mx-auto mb-24">
            <h2 className="text-3xl md:text-5xl font-semibold tracking-tight mb-6">
                Built for the <span className="text-blue-400">Autonomous Economy</span>.
            </h2>
            <p className="text-xl text-muted-foreground leading-relaxed">
                Running a fleet of AI agents shouldn't mean sharing your personal credit card. 
                CreditClaw provides secure, dedicated spending infrastructure for your digital workforce.
            </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
          {features.map((feature, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.1 }}
              className="p-6 rounded-2xl bg-white/5 border border-white/5 hover:border-white/10 hover:bg-white/10 transition-colors group"
            >
              <div className="w-12 h-12 rounded-xl bg-blue-500/10 flex items-center justify-center mb-6 text-blue-400 group-hover:scale-110 transition-transform">
                <feature.icon size={24} />
              </div>
              <h3 className="text-lg font-semibold mb-3">{feature.title}</h3>
              <p className="text-muted-foreground leading-relaxed text-sm">
                {feature.description}
              </p>
            </motion.div>
          ))}
        </div>

      </div>
    </section>
  );
}