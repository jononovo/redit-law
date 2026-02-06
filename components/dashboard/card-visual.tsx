import { cn } from "@/lib/utils";

interface CardVisualProps {
  color?: "primary" | "dark" | "blue" | "purple";
  last4?: string;
  expiry?: string;
  holder?: string;
  balance?: string;
  className?: string;
}

export function CardVisual({ 
  color = "primary", 
  last4 = "4242", 
  expiry = "12/28", 
  holder = "OPENCLAW AGENT 01",
  balance = "$5,000.00",
  className 
}: CardVisualProps) {
  
  const gradients = {
    primary: "bg-gradient-to-br from-primary to-orange-600",
    dark: "bg-gradient-to-br from-neutral-900 to-neutral-800",
    blue: "bg-gradient-to-br from-blue-500 to-blue-700",
    purple: "bg-gradient-to-br from-purple-500 to-purple-700"
  };

  return (
    <div className={cn(
      "relative aspect-[1.586/1] rounded-2xl p-6 text-white shadow-xl overflow-hidden flex flex-col justify-between select-none transition-transform hover:scale-[1.02]",
      gradients[color],
      className
    )}>
      <div className="absolute inset-0 opacity-20 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] mix-blend-overlay pointer-events-none" />
      <div className="absolute -top-[100%] -left-[100%] w-[300%] h-[300%] bg-gradient-to-br from-white/20 via-transparent to-transparent rotate-45 pointer-events-none" />

      <div className="relative z-10 flex justify-between items-start">
        <div className="flex flex-col">
            <span className="text-xs font-medium opacity-80 uppercase tracking-wider mb-1">Current Balance</span>
            <span className="text-2xl font-bold font-mono tracking-tight">{balance}</span>
        </div>
        <div className="w-10 h-6 rounded bg-white/20 backdrop-blur-sm border border-white/30 flex items-center justify-center">
            <div className="w-6 h-4 border border-white/40 rounded-[2px] relative overflow-hidden">
                <div className="absolute top-1 left-0 w-full h-[1px] bg-white/40" />
                <div className="absolute bottom-1 left-0 w-full h-[1px] bg-white/40" />
                <div className="absolute left-2 top-0 h-full w-[1px] bg-white/40" />
            </div>
        </div>
      </div>

      <div className="relative z-10">
        <div className="flex items-end justify-between">
            <div className="flex flex-col gap-4">
                <div className="flex gap-3 text-lg font-mono tracking-widest opacity-90">
                    <span>····</span>
                    <span>····</span>
                    <span>····</span>
                    <span>{last4}</span>
                </div>
                <div className="flex flex-col">
                    <span className="text-[10px] uppercase opacity-70 tracking-wider">Card Holder</span>
                    <span className="text-sm font-medium uppercase tracking-wide">{holder}</span>
                </div>
            </div>
            
            <div className="flex flex-col items-end">
                <span className="text-[10px] uppercase opacity-70 tracking-wider">Expires</span>
                <span className="text-sm font-mono">{expiry}</span>
                <div className="mt-2 text-xl font-bold italic tracking-tighter opacity-90">VISA</div>
            </div>
        </div>
      </div>
    </div>
  );
}
