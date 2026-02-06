import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { ArrowRight, CheckCircle2 } from "lucide-react";
import heroImage from "@/assets/images/credit-claw-jessica.png";
import { TransactionLedger } from "@/components/transaction-ledger";

export function Hero() {
  return (
    <section className="relative min-h-[90vh] flex items-center pt-24 overflow-hidden bg-background text-foreground">
      
      {/* Soft Gradient Background */}
      <div className="absolute top-0 right-0 w-[800px] h-[800px] bg-indigo-500/5 rounded-full blur-[120px] pointer-events-none -translate-y-1/2 translate-x-1/2" />
      <div className="absolute bottom-0 left-0 w-[600px] h-[600px] bg-blue-500/5 rounded-full blur-[100px] pointer-events-none translate-y-1/2 -translate-x-1/2" />

      <div className="container mx-auto px-6 grid lg:grid-cols-2 gap-16 items-center relative z-10">
        
        <div className="space-y-10">
          <div className="space-y-6">
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-sm font-medium text-blue-200"
            >
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
              </span>
              Now inviting beta users
            </motion.div>

            <motion.h1 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.1 }}
              className="text-5xl md:text-7xl font-semibold tracking-tight leading-[1.1]"
            >
              The corporate card for your <span className="text-blue-400">AI agents</span>.
            </motion.h1>

            <motion.p 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="text-lg md:text-xl text-muted-foreground max-w-lg leading-relaxed"
            >
              Empower your OpenClaw bots to handle business expenses autonomously. Set limits, track spending, and automate receipts—safely.
            </motion.p>
          </div>

          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="flex flex-col sm:flex-row gap-4"
          >
            <Button size="lg" className="rounded-full h-14 px-8 bg-white text-black hover:bg-neutral-200 font-medium text-base">
              Get your card <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
            <Button size="lg" variant="outline" className="rounded-full h-14 px-8 border-white/10 hover:bg-white/5 bg-transparent font-medium text-base">
              View demo
            </Button>
          </motion.div>

          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 1, delay: 0.5 }}
            className="flex gap-6 text-sm text-muted-foreground pt-4"
          >
             <div className="flex items-center gap-2">
               <CheckCircle2 className="h-4 w-4 text-blue-400" /> No personal liability
             </div>
             <div className="flex items-center gap-2">
               <CheckCircle2 className="h-4 w-4 text-blue-400" /> FDIC insured*
             </div>
          </motion.div>
        </div>

        <div className="relative h-[600px] flex items-center justify-center lg:justify-end perspective-[1000px]">
            <motion.div 
              initial={{ opacity: 0, rotateY: -20, x: 50 }}
              animate={{ opacity: 1, rotateY: -10, x: 0 }}
              transition={{ duration: 1.2, ease: "easeOut" }}
              className="relative w-full max-w-md aspect-[3/4] z-10 shadow-2xl rounded-3xl overflow-hidden ring-1 ring-white/10 bg-neutral-900"
            >
                 <img 
                    src={heroImage} 
                    alt="CreditClaw Titanium Card"
                    className="object-cover w-full h-full opacity-90 scale-105"
                 />
                 
                 {/* Consumer-friendly Overlay */}
                 <div className="absolute inset-0 p-8 flex flex-col justify-between pointer-events-none bg-gradient-to-t from-black/80 via-transparent to-transparent">
                    <div className="flex justify-between items-start">
                        {/* Chip graphic overlay could go here if image didn't have it */}
                    </div>
                    <div>
                         <div className="font-mono text-xl text-white/90 tracking-widest mb-2 shadow-black drop-shadow-md">
                            4000 1234 5678 9010
                         </div>
                         <div className="flex justify-between items-end">
                             <div className="font-medium text-white/80 text-sm tracking-widest uppercase">
                                Agent Jessica
                             </div>
                             <div className="font-medium text-white/60 text-xs uppercase">
                                Exp 09/29
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