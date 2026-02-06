import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { ArrowRight, Sparkles } from "lucide-react";
import heroImage from "@/assets/images/fun-claw-card.png";
import { TransactionLedger } from "@/components/transaction-ledger";

export function Hero() {
  return (
    <section className="relative min-h-[90vh] flex items-center pt-24 overflow-hidden bg-background">
      
      {/* Fun Blobs */}
      <div className="absolute top-20 right-20 w-[600px] h-[600px] bg-orange-200/40 rounded-full blur-[100px] pointer-events-none mix-blend-multiply animate-pulse" />
      <div className="absolute bottom-20 left-20 w-[500px] h-[500px] bg-blue-200/40 rounded-full blur-[80px] pointer-events-none mix-blend-multiply" />
      <div className="absolute top-1/2 left-1/2 w-[400px] h-[400px] bg-purple-200/40 rounded-full blur-[80px] pointer-events-none mix-blend-multiply -translate-x-1/2 -translate-y-1/2" />

      <div className="container mx-auto px-6 grid lg:grid-cols-2 gap-12 items-center relative z-10">
        
        <div className="space-y-8 text-center lg:text-left">
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-orange-100 text-orange-700 font-bold text-sm"
          >
            <Sparkles size={14} className="text-orange-500" />
            <span>Pocket money for your bots!</span>
          </motion.div>

          <motion.h1 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="text-5xl md:text-7xl font-extrabold tracking-tight text-neutral-900 leading-[1.1]"
          >
            Give your <span className="text-primary">Claw Agent</span> a credit card.
          </motion.h1>

          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="text-xl text-neutral-600 max-w-lg mx-auto lg:mx-0 leading-relaxed font-medium"
          >
            Your bot works hard. Let it buy its own API credits (responsibly). Set a weekly allowance and never worry about surprise bills again.
          </motion.p>

          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start"
          >
            <Button size="lg" className="rounded-full h-14 px-8 bg-neutral-900 text-white hover:bg-neutral-800 font-bold text-lg shadow-xl shadow-neutral-900/20 transform hover:-translate-y-1 transition-all duration-200">
              Sign Up Now <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
            <Button size="lg" variant="secondary" className="rounded-full h-14 px-8 bg-white text-neutral-900 hover:bg-neutral-50 font-bold text-lg border border-neutral-200 shadow-sm">
              See How It Works
            </Button>
          </motion.div>

          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8, delay: 0.5 }}
            className="pt-4 flex items-center justify-center lg:justify-start gap-2 text-sm font-semibold text-neutral-500"
          >
             <span className="flex -space-x-2">
                {[1,2,3,4].map(i => (
                    <div key={i} className="w-8 h-8 rounded-full border-2 border-white bg-neutral-200" />
                ))}
             </span>
             <span className="ml-2">Join 14,000+ happy bot owners</span>
          </motion.div>
        </div>

        <div className="relative flex justify-center perspective-[1000px]">
            <motion.div 
              initial={{ opacity: 0, rotate: 10, scale: 0.8 }}
              animate={{ opacity: 1, rotate: -5, scale: 1 }}
              transition={{ duration: 0.8, type: "spring" }}
              className="relative w-full max-w-[500px] z-10"
            >
                <img 
                    src={heroImage} 
                    alt="Fun 3D Claw Card" 
                    className="w-full h-auto drop-shadow-2xl hover:scale-105 transition-transform duration-500"
                />
                 
                 {/* Floating Badges */}
                 <motion.div 
                    animate={{ y: [0, -10, 0] }}
                    transition={{ repeat: Infinity, duration: 4, ease: "easeInOut" }}
                    className="absolute -top-4 -right-4 bg-white p-3 rounded-2xl shadow-xl border border-neutral-100 rotate-6"
                 >
                    <span className="text-2xl">🍕</span>
                 </motion.div>
                 <motion.div 
                    animate={{ y: [0, 10, 0] }}
                    transition={{ repeat: Infinity, duration: 5, ease: "easeInOut", delay: 1 }}
                    className="absolute bottom-10 -left-8 bg-white p-3 rounded-2xl shadow-xl border border-neutral-100 -rotate-12"
                 >
                    <span className="text-2xl">🤖</span>
                 </motion.div>

                 {/* Floating Ledger Component */}
                 <div className="absolute -bottom-12 right-0 md:-right-12">
                    <TransactionLedger />
                 </div>
            </motion.div>
        </div>

      </div>
    </section>
  );
}