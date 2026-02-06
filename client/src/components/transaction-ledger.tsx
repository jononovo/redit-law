import { motion } from "framer-motion";
import { ArrowUpRight, ArrowDownLeft, Check, Clock } from "lucide-react";

const transactions = [
  { id: 1, text: "OpenAI API Credits", amount: "-$40.00", type: "debit", status: "cleared", time: "2m ago" },
  { id: 2, text: "Top-up from Main", amount: "+$100.00", type: "credit", status: "cleared", time: "15m ago" },
  { id: 3, text: "AWS EC2 Spot", amount: "-$12.50", type: "debit", status: "pending", time: "1h ago" },
  { id: 4, text: "Vercel Pro Seat", amount: "-$20.00", type: "debit", status: "cleared", time: "3h ago" },
];

export function TransactionLedger() {
  return (
    <motion.div 
      initial={{ opacity: 0, x: 50 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.8, delay: 1, ease: "circOut" }}
      className="absolute -right-12 bottom-12 z-20 w-80 bg-black/80 backdrop-blur-xl border border-white/10 p-0 shadow-2xl overflow-hidden rounded-sm"
    >
      <div className="flex items-center justify-between p-4 border-b border-white/5 bg-white/5">
        <div className="font-mono text-[10px] uppercase tracking-widest text-neutral-400">Live_Ledger</div>
        <div className="h-1.5 w-1.5 rounded-full bg-[hsl(var(--accent))] animate-pulse" />
      </div>
      
      <div className="divide-y divide-white/5">
        {transactions.map((tx, i) => (
          <motion.div 
            key={tx.id}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 1.2 + (i * 0.1) }}
            className="flex items-center justify-between p-4 group hover:bg-white/5 transition-colors cursor-default"
          >
            <div className="flex items-center gap-3">
              <div className={`p-1.5 rounded-full ${tx.type === 'credit' ? 'bg-[hsl(var(--accent))]/10 text-[hsl(var(--accent))]' : 'bg-white/5 text-neutral-400'}`}>
                {tx.type === 'credit' ? <ArrowDownLeft size={12} /> : <ArrowUpRight size={12} />}
              </div>
              <div>
                <div className="text-xs font-medium text-neutral-200">{tx.text}</div>
                <div className="text-[10px] text-neutral-500 font-mono flex items-center gap-1">
                  {tx.status === 'pending' ? <Clock size={8} /> : <Check size={8} />} {tx.time}
                </div>
              </div>
            </div>
            <div className={`text-xs font-mono tracking-tight ${tx.type === 'credit' ? 'text-[hsl(var(--accent))]' : 'text-white'}`}>
              {tx.amount}
            </div>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}