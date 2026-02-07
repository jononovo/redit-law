"use client";

import { useState, useEffect, useRef } from "react";
import Image from "next/image";

function Counter({ end, duration = 2000, prefix = "", suffix = "" }: { end: number, duration?: number, prefix?: string, suffix?: string }) {
  const [count, setCount] = useState(0);
  const elementRef = useRef<HTMLDivElement>(null);
  const hasAnimated = useRef(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        if (entry.isIntersecting && !hasAnimated.current) {
          hasAnimated.current = true;
          let startTime: number | null = null;
          
          const animate = (currentTime: number) => {
            if (!startTime) startTime = currentTime;
            const progress = Math.min((currentTime - startTime) / duration, 1);
            const ease = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress);
            setCount(Math.floor(ease * end));

            if (progress < 1) {
              requestAnimationFrame(animate);
            }
          };
          
          requestAnimationFrame(animate);
        }
      },
      { threshold: 0.1 }
    );

    const currentElement = elementRef.current;
    if (currentElement) {
      observer.observe(currentElement);
    }

    return () => {
      if (currentElement) {
        observer.unobserve(currentElement);
      }
    };
  }, [end, duration]);

  return (
    <div ref={elementRef} className="inline-block">
      {prefix}{count.toLocaleString()}{suffix}
    </div>
  );
}

export function LiveMetrics() {
  return (
    <section className="py-16 bg-[#FDFBF7] border-b border-neutral-100">
      <div className="container mx-auto px-6">
        <div className="flex items-center gap-2 mb-12">
          <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse shadow-[0_0_8px_rgba(239,68,68,0.5)]" />
          <span className="text-xs font-mono text-neutral-500 uppercase tracking-[0.2em] font-medium">Live metrics</span>
        </div>

        <div className="grid md:grid-cols-3 gap-12 md:gap-8 mb-16 relative">
            <div className="hidden md:block absolute top-0 bottom-0 left-1/3 w-px bg-neutral-200/60" />
            <div className="hidden md:block absolute top-0 bottom-0 right-1/3 w-px bg-neutral-200/60" />

          <div className="pr-4 animate-fade-in-up">
            <h3 className="text-xs font-mono text-neutral-400 uppercase tracking-[0.2em] mb-4">Waitlist</h3>
            <div className="text-6xl font-bold text-neutral-800 mb-3 tracking-tight">
              <Counter end={1259} />
            </div>
            <p className="text-neutral-500 text-sm font-medium leading-relaxed">Waiting for virtual<br/>card issuance</p>
          </div>

          <div 
             style={{ animationDelay: '0.1s' }}
             className="md:pl-8 pr-4 animate-fade-in-up"
          >
            <h3 className="text-xs font-mono text-neutral-400 uppercase tracking-[0.2em] mb-4">Active Now</h3>
            <div className="text-6xl font-bold text-neutral-800 mb-3 tracking-tight">
              <Counter end={37} />
            </div>
            <p className="text-neutral-500 text-sm font-medium leading-relaxed">Bot wallets with<br/>spending controls</p>
          </div>

          <div 
             style={{ animationDelay: '0.2s' }}
             className="md:pl-8 animate-fade-in-up"
          >
            <h3 className="text-xs font-mono text-neutral-400 uppercase tracking-[0.2em] mb-4">Funds Managed</h3>
            <div className="text-6xl font-bold text-[#FF6B6B] mb-3 tracking-tight">
              <Counter end={2000} prefix="$" />
            </div>
            <p className="text-neutral-500 text-sm font-medium leading-relaxed">Allowances &amp; payments<br/>(USD)</p>
          </div>
        </div>

        <div 
          style={{ animationDelay: '0.4s' }}
          className="pt-8 border-t border-neutral-200/60 flex flex-col md:flex-row items-start md:items-center gap-6 md:gap-12 animate-fade-in-up"
        >
          <span className="text-xs font-mono text-neutral-400 uppercase tracking-[0.2em]">Accepted Cards</span>
          
          <div className="flex flex-wrap items-center gap-8 md:gap-12">
            <div className="flex items-center gap-2 group cursor-default">
              <Image 
                src="https://upload.wikimedia.org/wikipedia/commons/thumb/d/d6/Visa_2021.svg/1200px-Visa_2021.svg.png" 
                alt="Visa" 
                width={48}
                height={16}
                className="h-4 w-auto object-contain"
                unoptimized
              />
            </div>

            <div className="flex items-center gap-3 group cursor-default">
              <Image 
                src="https://upload.wikimedia.org/wikipedia/commons/thumb/a/a4/Mastercard_2019_logo.svg/1200px-Mastercard_2019_logo.svg.png" 
                alt="MasterCard" 
                width={48}
                height={24}
                className="h-6 w-auto object-contain"
                unoptimized
              />
            </div>

            <div className="flex items-center gap-3 group cursor-default">
              <Image 
                src="https://upload.wikimedia.org/wikipedia/commons/thumb/b/ba/Stripe_Logo%2C_revised_2016.svg/2560px-Stripe_Logo%2C_revised_2016.svg.png" 
                alt="Stripe" 
                width={48}
                height={24}
                className="h-6 w-auto object-contain"
                unoptimized
              />
              <span className="text-[10px] font-bold text-green-600">Powered by</span>
            </div>

            <div className="flex items-center gap-2 group cursor-default">
               <Image 
                src="https://upload.wikimedia.org/wikipedia/commons/thumb/f/fa/American_Express_logo_%282018%29.svg/1200px-American_Express_logo_%282018%29.svg.png" 
                alt="American Express" 
                width={48}
                height={24}
                className="h-6 w-auto object-contain"
                unoptimized
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
