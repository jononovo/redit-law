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
            <div className="text-6xl font-bold text-neutral-800 mb-3 tracking-tight">1,259</div>
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
            {/* Visa */}
            <div className="flex items-center gap-3 group cursor-default">
              <img 
                src="https://upload.wikimedia.org/wikipedia/commons/thumb/d/d6/Visa_2021.svg/1200px-Visa_2021.svg.png" 
                alt="Visa" 
                className="h-4 w-auto object-contain"
              />
              <span className="text-[10px] font-bold text-green-700 bg-green-50 px-2 py-0.5 rounded-full border border-green-100">Live</span>
            </div>

            {/* MasterCard */}
            <div className="flex items-center gap-3 group cursor-default opacity-60 grayscale hover:grayscale-0 transition-all duration-300">
              <img 
                src="https://upload.wikimedia.org/wikipedia/commons/thumb/a/a4/Mastercard_2019_logo.svg/1200px-Mastercard_2019_logo.svg.png" 
                alt="MasterCard" 
                className="h-6 w-auto object-contain"
              />
            </div>

            {/* Stripe */}
            <div className="flex items-center gap-3 group cursor-default opacity-60 grayscale hover:grayscale-0 transition-all duration-300">
              <img 
                src="https://upload.wikimedia.org/wikipedia/commons/thumb/b/ba/Stripe_Logo%2C_revised_2016.svg/2560px-Stripe_Logo%2C_revised_2016.svg.png" 
                alt="Stripe" 
                className="h-6 w-auto object-contain"
              />
            </div>

            {/* Amex (Coming Soon) */}
            <div className="flex items-center gap-3 group cursor-default opacity-60 grayscale hover:grayscale-0 transition-all duration-300">
               <img 
                src="https://upload.wikimedia.org/wikipedia/commons/thumb/f/fa/American_Express_logo_%282018%29.svg/1200px-American_Express_logo_%282018%29.svg.png" 
                alt="American Express" 
                className="h-6 w-auto object-contain"
              />
               <span className="text-[10px] font-bold text-neutral-500 bg-neutral-100 px-2 py-0.5 rounded-full border border-neutral-200">Coming Soon</span>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}