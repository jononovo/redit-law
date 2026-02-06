import { motion } from "framer-motion";

export function LiveMetrics() {
  return (
    <section className="py-16 bg-[#FDFBF7] border-b border-neutral-100">
      <div className="container mx-auto px-6">
        <div className="flex items-center gap-2 mb-12">
          <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse shadow-[0_0_8px_rgba(239,68,68,0.5)]" />
          <span className="text-xs font-mono text-neutral-500 uppercase tracking-[0.2em] font-medium">Live metrics</span>
        </div>

        <div className="grid md:grid-cols-3 gap-12 md:gap-8 mb-16 relative">
            {/* Vertical Dividers for MD+ */}
            <div className="hidden md:block absolute top-0 bottom-0 left-1/3 w-px bg-neutral-200/60" />
            <div className="hidden md:block absolute top-0 bottom-0 right-1/3 w-px bg-neutral-200/60" />

          {/* Waitlist */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="pr-4"
          >
            <h3 className="text-xs font-mono text-neutral-400 uppercase tracking-[0.2em] mb-4">Waitlist</h3>
            <div className="text-6xl font-bold text-neutral-800 mb-3 tracking-tight">18,259</div>
            <p className="text-neutral-500 text-sm font-medium leading-relaxed">Agents waiting for<br/>invitation codes</p>
          </motion.div>

          {/* Approved */}
          <motion.div 
             initial={{ opacity: 0, y: 20 }}
             whileInView={{ opacity: 1, y: 0 }}
             viewport={{ once: true }}
             transition={{ duration: 0.5, delay: 0.1 }}
             className="md:pl-8 pr-4"
          >
            <h3 className="text-xs font-mono text-neutral-400 uppercase tracking-[0.2em] mb-4">Approved</h3>
            <div className="text-6xl font-bold text-neutral-800 mb-3 tracking-tight">37</div>
            <p className="text-neutral-500 text-sm font-medium leading-relaxed">Agents with<br/>active credit</p>
          </motion.div>

          {/* Credit Issued */}
          <motion.div 
             initial={{ opacity: 0, y: 20 }}
             whileInView={{ opacity: 1, y: 0 }}
             viewport={{ once: true }}
             transition={{ duration: 0.5, delay: 0.2 }}
             className="md:pl-8"
          >
            <h3 className="text-xs font-mono text-neutral-400 uppercase tracking-[0.2em] mb-4">Credit Issued</h3>
            <div className="text-6xl font-bold text-[#FF6B6B] mb-3 tracking-tight">$2k</div>
            <p className="text-neutral-500 text-sm font-medium leading-relaxed">Total credit extended<br/>(USD)</p>
          </motion.div>
        </div>

        <motion.div 
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.4 }}
          className="pt-8 border-t border-neutral-200/60 flex flex-col md:flex-row items-start md:items-center gap-6 md:gap-12"
        >
          <span className="text-xs font-mono text-neutral-400 uppercase tracking-[0.2em]">Supported Networks</span>
          
          <div className="flex flex-wrap items-center gap-8 md:gap-12">
            {/* XRPL */}
            <div className="flex items-center gap-3 group cursor-default">
              <svg viewBox="0 0 24 24" className="w-6 h-6 fill-black" xmlns="http://www.w3.org/2000/svg">
                <path d="M12.001 0C5.376 0 0 5.375 0 11.999c0 6.626 5.376 12 12.001 12 6.623 0 12-5.374 12-12C24.001 5.375 18.624 0 12.001 0zm0 2.182c5.421 0 9.818 4.396 9.818 9.817 0 5.423-4.397 9.819-9.818 9.819-5.423 0-9.818-4.396-9.818-9.819 0-5.421 4.395-9.817 9.818-9.817zM9.546 6.818 7.365 9l4.636 4.636 4.635-4.636-2.182-2.182L12.001 9.273 9.546 6.818zm4.909 10.364 2.181-2.182-4.635-4.636L7.365 15l2.181 2.182 2.455-2.455 2.454 2.455z"/>
              </svg>
              <div className="flex items-center gap-2">
                 <span className="font-bold text-neutral-900">XRPL</span>
                 <span className="text-[10px] font-bold text-green-700 bg-green-50 px-2 py-0.5 rounded-full border border-green-100">Live</span>
              </div>
            </div>

            {/* Solana */}
            <div className="flex items-center gap-3 group cursor-default">
              <div className="flex flex-col gap-[3px] w-6">
                 <div className="h-[2px] w-full bg-gradient-to-r from-green-400 to-blue-500 rounded-full"></div>
                 <div className="h-[2px] w-full bg-gradient-to-r from-blue-500 to-green-400 rounded-full"></div>
                 <div className="h-[2px] w-full bg-gradient-to-r from-green-400 to-blue-500 rounded-full"></div>
              </div>
              <div className="flex items-center gap-2">
                 <span className="font-bold text-neutral-900">Solana</span>
                 <span className="text-[10px] font-bold text-green-700 bg-green-50 px-2 py-0.5 rounded-full border border-green-100">Live</span>
              </div>
            </div>

            {/* Base */}
            <div className="flex items-center gap-3 group cursor-default opacity-60 grayscale hover:grayscale-0 transition-all duration-300">
              <div className="w-6 h-6 rounded-full bg-[#0052FF] flex items-center justify-center relative overflow-hidden">
                 <div className="absolute top-1/2 left-1/2 w-4 h-4 bg-transparent border-2 border-white rounded-full -translate-x-1/2 -translate-y-1/2" />
              </div>
              <div className="flex items-center gap-2">
                 <span className="font-bold text-neutral-900">Base</span>
                 <span className="text-[10px] font-bold text-neutral-500 bg-neutral-100 px-2 py-0.5 rounded-full border border-neutral-200">Coming Soon</span>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}