import { motion } from "framer-motion";
import { ShieldCheck, PiggyBank, ShoppingBag, Zap } from "lucide-react";

const features = [
  {
    icon: PiggyBank,
    color: "bg-pink-100 text-pink-600",
    title: "Allowance Mode",
    description: "Set a weekly $50 budget. When it's gone, it's gone. No runaway API bills!"
  },
  {
    icon: ShieldCheck,
    color: "bg-green-100 text-green-600",
    title: "Safe & Secure",
    description: "Your main credit card is never exposed. We use virtual numbers that lock to specific merchants."
  },
  {
    icon: Zap,
    color: "bg-yellow-100 text-yellow-600",
    title: "Instant Setup",
    description: "Connect your OpenClaw agent in seconds. \"Hey Claw, here's your new card!\""
  },
  {
    icon: ShoppingBag,
    color: "bg-blue-100 text-blue-600",
    title: "Smart Shopping",
    description: "Your bot can buy software, domains, and data. We categorize everything for you."
  }
];

export function Features() {
  return (
    <section id="features" className="py-24 bg-white">
      <div className="container mx-auto px-6">
        
        <div className="text-center max-w-2xl mx-auto mb-16">
            <h2 className="text-4xl font-extrabold tracking-tight text-neutral-900 mb-6">
                Why bots <span className="text-primary">love</span> CreditClaw.
            </h2>
            <p className="text-lg text-neutral-500 font-medium">
                It's like giving your kid a debit card, but your kid is a super-intelligent AI that runs your business.
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
              className="p-8 rounded-3xl bg-neutral-50 hover:bg-white hover:shadow-xl transition-all duration-300 border border-neutral-100 group"
            >
              <div className={`w-14 h-14 rounded-2xl ${feature.color} flex items-center justify-center mb-6 text-2xl group-hover:scale-110 transition-transform shadow-sm`}>
                <feature.icon size={28} />
              </div>
              <h3 className="text-xl font-bold text-neutral-900 mb-3">{feature.title}</h3>
              <p className="text-neutral-500 font-medium leading-relaxed">
                {feature.description}
              </p>
            </motion.div>
          ))}
        </div>

      </div>
    </section>
  );
}