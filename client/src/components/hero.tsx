import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";
import heroImage from "@/assets/images/credit-claw-jessica.png";
import { TransactionLedger } from "@/components/transaction-ledger";

export function Hero() {
  return (
    <section className="relative min-h-screen flex items-center pt-20 overflow-hidden bg-black text-white selection:bg-[hsl(var(--accent))] selection:text-black">
      
      {/* Background Pattern */}
      <div className="absolute inset-0 z-0 opacity-20 pointer-events-none">
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:40px_40px]" />
        <div className="absolute inset-0 bg-gradient-to-r from-black via-transparent to-black" />
      </div>

      {/* Abstract decorative line */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1px] h-full bg-gradient-to-b from-transparent via-[hsl(var(--border))] to-transparent opacity-50 z-0" />

      <div className="container mx-auto px-6 grid lg:grid-cols-2 gap-20 items-center relative z-10">
        
        <div className="space-y-12">
          <div className="space-y-6">
            <motion.div 
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.8, ease: "circOut" }}
              className="font-mono text-[10px] uppercase tracking-[0.2em] text-[hsl(var(--accent))]"
            >
              01 — Financial Infrastructure
            </motion.div>

            <motion.h1 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.2, ease: "circOut" }}
              className="text-6xl md:text-8xl font-light tracking-tighter leading-[0.9] text-balance"
            >
              Silent<br />
              Security.
            </motion.h1>

            <motion.p 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 1, delay: 0.6 }}
              className="text-sm md:text-base text-neutral-400 max-w-md font-light leading-relaxed border-l border-neutral-800 pl-6"
            >
              The first autonomous payment rail designed for the machine economy. 
              Pure programmatic control. Zero friction.
            </motion.p>
          </div>

          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.8 }}
            className="flex flex-col items-start gap-4"
          >
            <div className="flex gap-4">
                <Button variant="outline" className="rounded-none h-12 px-8 border-neutral-800 bg-transparent hover:bg-white hover:text-black hover:border-white transition-all duration-300 font-mono text-xs uppercase tracking-wider">
                  Initialize
                </Button>
                <Button variant="ghost" className="rounded-none h-12 px-6 text-neutral-500 hover:text-white hover:text-black hover:bg-white font-mono text-xs uppercase tracking-wider group">
                  Documentation <ArrowRight className="ml-2 h-3 w-3 transition-transform group-hover:translate-x-1" />
                </Button>
            </div>
            
            <div className="font-mono text-[10px] text-neutral-600 pt-8">
              <span className="text-[hsl(var(--accent))]">●</span> SYSTEM_OPERATIONAL
            </div>
          </motion.div>
        </div>

        <div className="relative lg:h-[90vh] flex items-center justify-center lg:justify-end">
            <motion.div 
              initial={{ opacity: 0, x: 100 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 1.2, delay: 0.4, ease: [0.22, 1, 0.36, 1] }} // Custom bezier for smooth slide
              className="relative w-full max-w-xl aspect-[3/4] z-10"
            >
                 <div className="absolute inset-0 bg-neutral-900/10 overflow-hidden">
                    <img 
                        src={heroImage} 
                        alt="Minimal Etched Card"
                        className="object-cover w-full h-full opacity-90 mix-blend-normal contrast-110"
                    />
                     
                     {/* Minimal HUD Overlay */}
                     <div className="absolute inset-0 border border-white/5 p-8 flex flex-col justify-between pointer-events-none">
                        <div className="flex justify-between font-mono text-[9px] text-white/30 uppercase tracking-widest">
                            <span>CREDITCLAW INC.</span>
                            <span>[SECURE]</span>
                        </div>
                        <div className="space-y-2">
                             <div className="h-[1px] w-12 bg-[hsl(var(--accent))]" />
                             <div className="font-mono text-[9px] text-white/50 uppercase tracking-widest">
                                Auth_Key: 0x82...9F
                             </div>
                        </div>
                     </div>
                 </div>

                 {/* Floating Ledger Component */}
                 <TransactionLedger />
            </motion.div>
        </div>

      </div>
    </section>
  );
}