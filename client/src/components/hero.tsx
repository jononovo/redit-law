import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { ChevronRight, ShieldCheck, Cpu } from "lucide-react";
import clawCardHero from "@/assets/images/claw-card-hero.png";

export function Hero() {
  return (
    <section className="relative min-h-screen flex items-center pt-20 overflow-hidden">
      <div className="container mx-auto px-4 grid lg:grid-cols-2 gap-12 items-center">
        
        <div className="space-y-8 z-10">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-mono mb-4"
          >
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
            </span>
            SYSTEM_ONLINE // WAITING_FOR_INPUT
          </motion.div>

          <motion.h1 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="text-5xl md:text-7xl font-bold tracking-tight leading-none"
          >
            SECURE PAYMENTS FOR THE <br/>
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary via-secondary to-accent glitch-text" data-text="BOT ECONOMY">
              BOT ECONOMY
            </span>
          </motion.h1>

          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="text-lg text-muted-foreground max-w-xl"
          >
            Give your OpenClaw bot a secure prepaid credit card. Set spending limits via API, track transactions in real-time, and protect your main accounts.
          </motion.p>

          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="flex flex-col sm:flex-row gap-4"
          >
            <Button size="lg" className="bg-primary text-primary-foreground hover:bg-primary/90 font-bold h-12 px-8">
              INITIALIZE_CARD <ChevronRight className="ml-2 h-4 w-4" />
            </Button>
            <Button size="lg" variant="outline" className="h-12 px-8 border-white/10 hover:bg-white/5">
              VIEW_DOCUMENTATION
            </Button>
          </motion.div>

          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.4 }}
            className="flex items-center gap-6 text-sm text-muted-foreground font-mono pt-4"
          >
            <div className="flex items-center gap-2">
              <ShieldCheck className="text-primary h-4 w-4" />
              <span>BANK_GRADE_SECURITY</span>
            </div>
            <div className="flex items-center gap-2">
              <Cpu className="text-secondary h-4 w-4" />
              <span>BOT_FRIENDLY_API</span>
            </div>
          </motion.div>
        </div>

        <motion.div 
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.8 }}
          className="relative z-0 flex justify-center lg:justify-end"
        >
          <div className="relative w-full max-w-[500px] aspect-square">
            <div className="absolute inset-0 bg-primary/20 blur-[100px] rounded-full opacity-50 animate-pulse" />
            <img 
              src={clawCardHero} 
              alt="SecureClaw Holographic Card" 
              className="relative z-10 w-full h-auto drop-shadow-2xl animate-float"
              style={{
                animation: 'float 6s ease-in-out infinite'
              }}
            />
            
            {/* Decorative Code Overlay */}
            <div className="absolute -bottom-10 -left-10 p-4 bg-black/80 backdrop-blur border border-primary/30 rounded font-mono text-xs text-primary/80 hidden md:block">
              <p>{`> DETECTED_BOT: CLAW_V2`}</p>
              <p>{`> AUTHENTICATING...`}</p>
              <p className="text-green-400">{`> ACCESS_GRANTED`}</p>
              <p>{`> CREDIT_LIMIT: $50.00`}</p>
            </div>
          </div>
        </motion.div>

      </div>
      
      {/* Background Grid */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px] pointer-events-none -z-10" />
    </section>
  );
}

// Add keyframes for float animation to global CSS or component styles if needed, 
// but inline style works for quick mockup.
