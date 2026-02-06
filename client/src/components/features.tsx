import { motion } from "framer-motion";
import { Lock, Cpu, CreditCard, Globe, Zap, ShieldAlert } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

const features = [
  {
    icon: Cpu,
    title: "Bot-First Design",
    description: "Built specifically for OpenClaw bots. Issue cards programmatically via our REST API."
  },
  {
    icon: Lock,
    title: "Spending Controls",
    description: "Set strict daily, weekly, or merchant-specific spending limits. Never overspend again."
  },
  {
    icon: ShieldAlert,
    title: "Fraud Protection",
    description: "AI-driven fraud detection tuned for automated purchasing patterns."
  },
  {
    icon: CreditCard,
    title: "Instant Virtual Cards",
    description: "Generate disposable virtual cards instantly for one-time purchases."
  },
  {
    icon: Globe,
    title: "Global Acceptance",
    description: "Accepted anywhere major credit cards are processed. Works for SaaS, APIs, and cloud costs."
  },
  {
    icon: Zap,
    title: "Real-time Webhooks",
    description: "Get notified instantly when a transaction occurs via webhooks to your bot controller."
  }
];

export function Features() {
  return (
    <section id="features" className="py-24 relative bg-background/50">
      <div className="container mx-auto px-4">
        <div className="text-center max-w-2xl mx-auto mb-16">
          <h2 className="text-3xl md:text-5xl font-bold mb-4 font-sans">
            POWERED BY <span className="text-secondary">SECURE_CORE</span>
          </h2>
          <p className="text-muted-foreground">
            The infrastructure layer for the autonomous economy. Designed for developers, built for bots.
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((feature, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              viewport={{ once: true }}
            >
              <Card className="bg-card/50 border-white/5 backdrop-blur hover:border-primary/50 transition-colors duration-300 group h-full">
                <CardHeader>
                  <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4 group-hover:bg-primary/20 transition-colors">
                    <feature.icon className="text-primary h-6 w-6" />
                  </div>
                  <CardTitle className="font-sans text-xl">{feature.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground leading-relaxed">
                    {feature.description}
                  </p>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}