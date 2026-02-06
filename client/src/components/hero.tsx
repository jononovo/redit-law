import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowRight, Sparkles, Check } from "lucide-react";
import heroImage from "@/assets/images/fun-lobster-black-card.png";
import avatar1 from "@/assets/images/avatar_1.jpg";
import avatar2 from "@/assets/images/avatar_2.jpg";
import avatar3 from "@/assets/images/avatar_3.jpg";
import { TransactionLedger } from "@/components/transaction-ledger";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";

export function Hero() {
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [isJoined, setIsJoined] = useState(false);

  const handleJoin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    
    setIsJoined(true);
    toast({
      title: "Welcome to the club! 🦞",
      description: "You're on the list. We'll be in touch soon.",
    });
  };

  const avatars = [
    { type: 'image', src: avatar1 },
    { type: 'initial', text: 'JD', color: 'bg-blue-100 text-blue-700' },
    { type: 'image', src: avatar2 },
    { type: 'image', src: avatar3 },
    { type: 'initial', text: 'TS', color: 'bg-orange-100 text-orange-700' },
  ];

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
            {isJoined ? (
               <div className="h-14 px-8 rounded-full bg-green-50 text-green-700 border border-green-200 font-bold text-lg flex items-center gap-2 shadow-sm animate-in fade-in zoom-in duration-300">
                 <Check className="w-5 h-5" />
                 <span>You're on the list!</span>
               </div>
            ) : (
              <form onSubmit={handleJoin} className="relative w-full max-w-sm group">
                <Input 
                  type="email"
                  placeholder="Join Waitlist" 
                  className="h-16 pl-8 pr-20 rounded-full bg-white border-2 border-neutral-100 shadow-xl shadow-neutral-900/5 text-xl md:text-xl text-neutral-900 placeholder:text-neutral-400 focus-visible:ring-primary focus-visible:border-primary transition-all duration-300"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
                <Button 
                  type="submit" 
                  size="icon" 
                  className="absolute right-1.5 top-2.5 h-11 w-11 rounded-full bg-transparent text-neutral-400 hover:bg-neutral-900 hover:text-white hover:scale-105 transition-all duration-200"
                >
                  <ArrowRight className="h-6 w-6" />
                </Button>
              </form>
            )}
          </motion.div>

          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8, delay: 0.5 }}
            className="pt-0 -mt-2 flex items-center justify-center lg:justify-start gap-2 text-sm font-semibold text-neutral-500"
          >
             <span className="flex -space-x-3">
                {avatars.map((avatar, i) => (
                    <div key={i} className={`w-8 h-8 rounded-full border-2 border-white flex items-center justify-center overflow-hidden ${avatar.type === 'initial' ? avatar.color : 'bg-neutral-200'}`}>
                        {avatar.type === 'image' ? (
                            <img src={avatar.src} alt="User" className="w-full h-full object-cover" />
                        ) : (
                            <span className="text-[10px] font-bold">{avatar.text}</span>
                        )}
                    </div>
                ))}
             </span>
             <span className="ml-2">Join 14,000+ happy bot owners</span>
          </motion.div>
        </div>

        <div className="relative flex flex-col items-center justify-center perspective-[1000px]">
            <motion.div 
              initial={{ opacity: 0, rotate: 10, scale: 0.8 }}
              animate={{ opacity: 1, rotate: -5, scale: 1 }}
              transition={{ duration: 0.8, type: "spring" }}
              className="relative w-full max-w-[500px] z-10"
            >

      </div>
    </section>
  );
}