"use client";

import { useState, useEffect, useRef } from "react";


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
            <p className="text-neutral-500 text-sm font-medium leading-relaxed">Waiting for<br/>bot wallets</p>
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
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 780 500" className="h-5 w-auto">
                <path d="M293.2 348.7l33.4-195.8h53.3l-33.4 195.8zM541.3 157.5c-10.6-4-27.2-8.3-47.9-8.3-52.8 0-90 26.6-90.2 64.6-.3 28.1 26.5 43.8 46.8 53.2 20.8 9.6 27.8 15.8 27.7 24.4-.1 13.2-16.6 19.2-32 19.2-21.4 0-32.7-3-50.3-10.2l-6.9-3.1-7.5 44c12.5 5.5 35.6 10.2 59.6 10.5 56.2 0 92.6-26.3 93-67 .2-22.3-14-39.3-44.8-53.3-18.7-9.1-30.1-15.1-30-24.3 0-8.1 9.7-16.8 30.6-16.8 17.5-.3 30.1 3.5 40 7.5l4.8 2.3 7.1-42.7zM676 152.9h-41.3c-12.8 0-22.4 3.5-28 16.3l-79.4 179.5h56.2s9.2-24.2 11.3-29.5h68.6c1.6 6.9 6.5 29.5 6.5 29.5h49.7l-43.6-195.8zm-65.8 126.3c4.4-11.3 21.4-54.8 21.4-54.8-.3.5 4.4-11.4 7.1-18.8l3.6 17s10.3 47 12.5 56.6h-44.6zM247.6 152.9L195.3 280l-5.6-27.1c-9.7-31.2-39.8-65-73.5-81.9l47.9 176.5h56.6l84.2-195.6h-57.3z" fill="#1a1f71"/>
                <path d="M146.9 152.9H59.6l-.7 3.7c67.2 16.2 111.7 55.4 130.1 102.5l-18.8-90.2c-3.2-12.4-12.7-15.6-23.3-16z" fill="#f9a533"/>
              </svg>
            </div>

            <div className="flex items-center gap-3 group cursor-default">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 152.4 108" className="h-7 w-auto">
                <circle cx="68.7" cy="54" r="54" fill="#eb001b"/>
                <circle cx="83.7" cy="54" r="54" fill="#f79e1b"/>
                <path d="M76.2 12.8a53.9 53.9 0 0 0-20.5 41.2 53.9 53.9 0 0 0 20.5 41.2 53.9 53.9 0 0 0 20.5-41.2 53.9 53.9 0 0 0-20.5-41.2z" fill="#ff5f00"/>
              </svg>
            </div>

            <div className="flex items-center gap-3 group cursor-default">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 468 222.5" className="h-6 w-auto">
                <path fill="#635bff" d="M414 113.4c0-25.6-12.4-45.8-36.1-45.8-23.8 0-38.2 20.2-38.2 45.6 0 30.1 17 45.3 41.4 45.3 11.9 0 20.9-2.7 27.7-6.5v-20c-6.8 3.4-14.6 5.5-24.5 5.5-9.7 0-18.3-3.4-19.4-15.2h48.9c0-1.3.2-6.5.2-8.9zm-49.4-9.5c0-11.3 6.9-16 13.2-16 6.1 0 12.6 4.7 12.6 16h-25.8zM301.1 67.6c-9.8 0-16.1 4.6-19.6 7.8l-1.3-6.2h-22v116.6l25-5.3.1-28.3c3.6 2.6 8.9 6.3 17.7 6.3 17.9 0 34.2-14.4 34.2-46.1-.1-29-16.6-44.8-34.1-44.8zm-6 68.9c-5.9 0-9.4-2.1-11.8-4.7l-.1-37.1c2.6-2.9 6.2-4.9 11.9-4.9 9.1 0 15.4 10.2 15.4 23.3 0 13.4-6.2 23.4-15.4 23.4zM223.8 61.7l25.1-5.4V36l-25.1 5.3zM223.8 69.3h25.1v87.5h-25.1zM196.9 76.7l-1.6-7.4h-21.6v87.5h25V97.5c5.9-7.7 15.9-6.3 19-5.2v-23c-3.2-1.2-14.9-3.4-20.8 7.4zM146.9 47.6l-24.4 5.2-.1 80.1c0 14.8 11.1 25.7 25.9 25.7 8.2 0 14.2-1.5 17.5-3.3V135c-3.2 1.3-19 5.9-19-8.9V90.6h19V69.3h-19l.1-21.7zM79.3 94.7c0-3.9 3.2-5.4 8.5-5.4 7.6 0 17.2 2.3 24.8 6.4V72.2c-8.3-3.3-16.5-4.6-24.8-4.6C67.5 67.6 52 78.8 52 97.4c0 29.1 40 24.4 40 37 0 4.6-4 6.1-9.6 6.1-8.3 0-18.9-3.4-27.3-8v23.8c9.3 4 18.7 5.7 27.3 5.7 20.8 0 35.1-10.3 35.1-28.2-.1-31.4-40.2-25.8-40.2-37.1z"/>
              </svg>
              <span className="text-[10px] font-bold text-green-600">Powered by</span>
            </div>

            <div className="flex items-center gap-2 group cursor-default">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 750 471" className="h-6 w-auto">
                <rect width="750" height="471" rx="40" fill="#2557d6"/>
                <path d="M0 221.5h750M0 221.5v-35.2h750v35.2z" fill="none"/>
                <path d="M333 98.2h84v274.6h-84z" fill="#2557d6"/>
                <text x="375" y="270" fill="white" fontFamily="Arial,sans-serif" fontSize="56" fontWeight="bold" textAnchor="middle">AMEX</text>
              </svg>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
