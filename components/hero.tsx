"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowRight, Sparkles, Check } from "lucide-react";
import Image from "next/image";
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
    { type: 'image' as const, src: '/images/avatar_1.jpg' },
    { type: 'initial' as const, text: 'JD', color: 'bg-blue-100 text-blue-700' },
    { type: 'image' as const, src: '/images/avatar_2.jpg' },
    { type: 'image' as const, src: '/images/avatar_3.jpg' },
    { type: 'initial' as const, text: 'TS', color: 'bg-orange-100 text-orange-700' },
  ];

  return (
    <section className="relative min-h-[90vh] flex items-center pt-24 overflow-hidden bg-background">
      
      <div className="absolute top-20 right-20 w-[600px] h-[600px] bg-orange-200/40 rounded-full blur-[100px] pointer-events-none mix-blend-multiply animate-pulse" />
      <div className="absolute bottom-20 left-20 w-[500px] h-[500px] bg-blue-200/40 rounded-full blur-[80px] pointer-events-none mix-blend-multiply" />
      <div className="absolute top-1/2 left-1/2 w-[400px] h-[400px] bg-purple-200/40 rounded-full blur-[80px] pointer-events-none mix-blend-multiply -translate-x-1/2 -translate-y-1/2" />

      <div className="container mx-auto px-6 grid lg:grid-cols-2 gap-12 items-center relative z-10">
        
        <div className="space-y-8 text-center lg:text-left">
          <div 
            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-orange-100 text-orange-700 font-bold text-sm animate-fade-in-up"
          >
            <Sparkles size={14} className="text-orange-500" />
            <span>Pocket money for your bots!</span>
          </div>

          <h1 
            style={{ animationDelay: '0.1s' }}
            className="text-5xl md:text-7xl font-extrabold tracking-tight text-neutral-900 leading-[1.1] animate-fade-in-up"
          >
            Give your <span className="text-primary">Claw Agent</span> a credit card.
          </h1>

          <p 
            style={{ animationDelay: '0.2s' }}
            className="text-xl text-neutral-600 max-w-lg mx-auto lg:mx-0 leading-relaxed font-medium animate-fade-in-up"
          >
            Your bot works hard. Let it buy its own API credits (responsibly). Set a weekly allowance and never worry about surprise bills again.
          </p>

          <div 
            style={{ animationDelay: '0.3s' }}
            className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start animate-fade-in-up"
          >
            {isJoined ? (
               <div className="h-14 px-8 rounded-full bg-green-50 text-green-700 border border-green-200 font-bold text-lg flex items-center gap-2 shadow-sm animate-in fade-in zoom-in duration-300">
                 <Check className="w-5 h-5" />
                 <span>You&apos;re on the list!</span>
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
                  data-testid="input-waitlist-email"
                />
                <Button 
                  type="submit" 
                  size="icon" 
                  className="absolute right-1.5 top-2.5 h-11 w-11 rounded-full bg-transparent text-neutral-400 hover:bg-neutral-900 hover:text-white hover:scale-105 transition-all duration-200"
                  data-testid="button-waitlist-submit"
                >
                  <ArrowRight className="h-6 w-6" />
                </Button>
              </form>
            )}
          </div>

          <div 
            style={{ animationDelay: '0.5s' }}
            className="pt-0 -mt-2 flex items-center justify-center lg:justify-start gap-2 text-sm font-semibold text-neutral-500 animate-fade-in-up"
          >
             <span className="flex -space-x-3">
                {avatars.map((avatar, i) => (
                    <div key={i} className={`w-8 h-8 rounded-full border-2 border-white flex items-center justify-center overflow-hidden ${avatar.type === 'initial' ? avatar.color : 'bg-neutral-200'}`}>
                        {avatar.type === 'image' ? (
                            <Image src={avatar.src} alt="User" width={32} height={32} className="w-full h-full object-cover" />
                        ) : (
                            <span className="text-[10px] font-bold">{avatar.text}</span>
                        )}
                    </div>
                ))}
             </span>
             <span className="ml-2">Join 14,000+ happy bot owners</span>
          </div>
        </div>

        <div className="relative flex flex-col items-center justify-center perspective-[1000px]">
            <div 
              className="relative w-full max-w-[500px] z-10 animate-pop-in"
            >
                <Image 
                    src="/images/fun-lobster-black-card.png"
                    alt="Fun 3D Claw Card" 
                    width={500}
                    height={500}
                    className="w-full h-auto drop-shadow-2xl transition-transform duration-500"
                    priority
                />
                 
                 <div className="absolute -top-4 -right-4 animate-float">
                   <div className="bg-white p-3 rounded-2xl shadow-xl border border-neutral-100 rotate-6">
                      <span className="text-2xl">🍕</span>
                   </div>
                 </div>

                 <div className="absolute bottom-10 -left-8 animate-float-delayed">
                   <div className="bg-white p-3 rounded-2xl shadow-xl border border-neutral-100 -rotate-12">
                      <span className="text-2xl">🤖</span>
                   </div>
                 </div>

                 <div className="absolute -bottom-12 right-0 md:-right-12">
                    <TransactionLedger />
                 </div>
            </div>
        </div>
      </div>
    </section>
  );
}
