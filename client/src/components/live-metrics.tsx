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
            {/* Visa */}
            <div className="flex items-center gap-3 group cursor-default">
              <svg viewBox="0 0 32 10" className="h-4 w-auto fill-[#1434CB]" xmlns="http://www.w3.org/2000/svg">
                <path d="M11.83 0.17L7.96 7.42H5.34L3.18 1.15C3.06 0.69 2.94 0.62 2.56 0.47C1.94 0.22 0.93 0.12 0 0.12L0.23 1.18C0.47 1.23 0.94 1.3 1.25 1.47C1.65 1.69 1.66 1.94 1.73 2.21L2.88 8.08L0.01 8.08L0.01 8.35L4.41 8.35L4.54 7.74L4.85 7.74C5.16 7.74 5.37 7.55 5.48 7.3L5.61 6.8L5.3 5.34L7.54 5.34L7.75 6.4C7.83 6.82 7.79 7.27 7.37 7.27L7.14 7.27L7.14 7.54L10.34 7.54L10.34 7.27C9.92 7.27 9.77 6.95 9.88 6.55L12.87 0.44L11.83 0.17ZM7.27 4.15L6.11 4.15L6.68 1.44L7.27 4.15ZM14.07 7.54L17.26 7.54L17.26 7.27C16.85 7.27 16.7 6.95 16.8 6.55L19.26 0.44L18.22 0.17L14.35 7.42H11.73L9.57 1.15C9.45 0.69 9.33 0.62 8.95 0.47C8.33 0.22 7.32 0.12 6.39 0.12L6.62 1.18C6.86 1.23 7.33 1.3 7.64 1.47C8.04 1.69 8.05 1.94 8.12 2.21L9.27 8.08L6.4 8.08L6.4 8.35L10.8 8.35L10.93 7.74L11.24 7.74C11.55 7.74 11.76 7.55 11.87 7.3L12 6.8L11.69 5.34L13.93 5.34L14.14 6.4C14.22 6.82 14.18 7.27 13.76 7.27L13.53 7.27L13.53 7.54L16.73 7.54L16.73 7.27C16.31 7.27 16.16 6.95 16.27 6.55L18.73 0.44L17.69 0.17L14.07 7.54Z" style={{ display: 'none' }}/> 
                <path d="M12.986 0.264l-1.928 9.532h3.078l1.928-9.532h-3.078zm-4.72 0l-3.326 9.532h3.172l3.326-9.532H8.266zm14.15 3.738c.174-.888 1.332-1.096 1.764-1.118-.584-.87-2.306-1.026-3.012-.224-.872.936-.252 2.92.518 3.554.436.356 1.168.324 1.54.408.064.014.264.06.126.552-.22.684-1.42.544-1.844.426-.646-.174-1.122-.508-1.574-.914l-2.074 2.158c.954.912 2.376 1.464 3.784 1.464 3.636 0 5.488-1.748 5.488-4.47 0-3.64-5.068-3.792-4.994-5.402.022-.492.502-.852 1.574-.852 1.258 0 2.214.26 2.91.564l1.836-2.586C26.152.614 24.576.262 22.846.262c-3.742 0-6.374 1.99-6.392 4.838-.03 2.106 1.882 3.284 3.324 3.988 1.478.724 1.968 1.19 1.962 1.836-.008.994-1.252 1.45-2.404 1.45-1.602 0-2.454-.25-3.754-.824l-1.92 2.696c1.238.566 3.064 1.054 5.092 1.054 5.42 0 8.944-2.656 8.974-6.772.016-2.256-1.344-3.98-4.606-5.526-1.592-.79-2.568-1.314-2.568-2.122 0-.73.806-1.252 2.54-1.252.88 0 1.564.086 2.062.274l.654 3.072h2.608L22.416 3.996zM4.14 0.264H.028L.014 0.44C2.56 1.096 4.1 2.978 4.778 5.5l.846 3.104 2.87-9.532H5.66c-.732 0-1.36.422-1.52 1.192z" fill="#1434CB"/>
              </svg>
              <span className="text-[10px] font-bold text-green-700 bg-green-50 px-2 py-0.5 rounded-full border border-green-100">Live</span>
            </div>

            {/* MasterCard */}
            <div className="flex items-center gap-3 group cursor-default">
              <svg viewBox="0 0 24 18" className="h-5 w-auto" xmlns="http://www.w3.org/2000/svg">
                <circle cx="9" cy="9" r="9" fill="#EB001B"/>
                <circle cx="15" cy="9" r="9" fill="#F79E1B" fillOpacity="0.85"/>
              </svg>
              <span className="text-[10px] font-bold text-green-700 bg-green-50 px-2 py-0.5 rounded-full border border-green-100">Live</span>
            </div>

            {/* Stripe */}
            <div className="flex items-center gap-3 group cursor-default">
              <svg viewBox="0 0 60 25" className="h-5 w-auto fill-[#635BFF]" xmlns="http://www.w3.org/2000/svg">
                <path d="M59.64 14.28h-8.06c.19 1.93 1.6 2.55 3.2 2.55 1.64 0 2.96-.37 4.05-.95v3.32a8.33 8.33 0 0 1-4.55 1.1c-4.85 0-6.83-2.5-6.83-6.35 0-3.77 2.58-6.37 6.1-6.37 3.45 0 6.1 2.6 6.1 6.7zm-2.96-1.63c.01-1.06-.79-2.2-2.3-2.2-1.51 0-2.4 1.15-2.56 2.2H56.68zM33.25 0v19.92h-4.22V0h4.22zM23.1 8v12h-4.22V8H23.1zM10.87 8h4.22v12h-4.22V8zm12.24 0c3.4 0 5.8 2.5 5.8 6.04 0 3.51-2.4 6-5.8 6-1.74 0-3.05-.72-3.81-1.84V8.3a4.9 4.9 0 0 1 3.8-2.61v2.32zm-3.8 6.04c0 1.5 1.05 2.5 2.55 2.5 1.5 0 2.55-1 2.55-2.5 0-1.5-1.05-2.5-2.55-2.5-1.5 0-2.55 1-2.55 2.5zM21 2.3A2.3 2.3 0 1 1 16.4 2.3 2.3 2.3 0 0 1 21 2.3zM47.74 8v12h-4.22v-6.07c0-1.77-1.1-2.9-2.78-2.9a2.9 2.9 0 0 0-2.8 2.9V20h-4.22V8h3.94v1.8c.9-1.25 2.3-2.12 3.9-2.12 2.7 0 6.18 1.9 6.18 6.32zM9.4 8.44c0-2.3-1.6-3.7-4.1-3.7C2.17 4.74 0 6.64 0 6.64l.87 2.87S2.5 8 5.3 8c1.1 0 1.57.34 1.57.86 0 .5-.5 1.07-2.07 1.56-2.5.76-3.9 1.87-3.9 3.96 0 2.2 1.9 3.65 4.54 3.65 2.14 0 3.96-.8 3.96-.8v-3.77c0-.28-.2-.36-.45-.44l-2.73-.9c-1.3-.43-1.6-1.05-1.6-1.7 0-.74.77-1.23 2.02-1.23 1.5 0 2.76.6 2.76.6z"/>
              </svg>
              <span className="text-[10px] font-bold text-green-700 bg-green-50 px-2 py-0.5 rounded-full border border-green-100">Live</span>
            </div>

            {/* Amex (Coming Soon) */}
            <div className="flex items-center gap-3 group cursor-default opacity-60 grayscale hover:grayscale-0 transition-all duration-300">
               <svg viewBox="0 0 40 40" className="w-6 h-6 fill-[#006FCF]" xmlns="http://www.w3.org/2000/svg">
                 <rect width="40" height="40" rx="4" fill="#006FCF"/>
                 <path d="M11.66 22.18L10.32 19.34L8.94 22.18H11.66ZM21.94 15.6H25.04L24.16 13.56H19.7L18.42 16.48H16.68L19.78 9.32H27.3L30.22 16.48H28.42L27.08 13.56H25.6L26.54 15.6H29.1L30.82 19.66L29.58 22.18H32.6L36.32 14.28L34.1 9.32H38.2L40 13.56L37.82 18.06L40 22.18H36.32L34.98 19.34H33.52L32.22 22.18H30.42L31.74 19.34L30.36 16.48H29.62L27.18 22.18H18.7L17.76 19.34H14.12L15.34 22.18H18.06L16.22 26.5H12.92L14.48 22.18H12.32L10.96 25.04H8.72L10.08 22.18H4.66L9.62 10.82L0 10.82L0 22.18H7.4L9.16 26.5H12.26L14.72 19.34L17.18 26.5H23.5L25.96 19.34L28.42 26.5H35.08L40 16.48V9.32H25.76L23.72 13.56H22.78L20.82 9.32H13.66L15.48 13.56H11.42L11.88 12.12H13.78V10.82H6.94V12.12H8.84L6.92 16.48H5.16L8.26 9.32H12.82L10.66 4.36H4.36L0 14.28V30.68H40V14.28H36.9L39.18 9.32H35.08L37.26 4.36H30.96L28.8 9.32H24.26L26.44 4.36H20.14L17.96 9.32H13.42L15.6 4.36H9.3L4.94 14.28H10.18L8.14 18.06H12.44L11.36 15.6H14.88L15.98 18.06H18.96L16.42 12.12H18.32L19.58 15.6H20.48L21.74 12.12H23.64L21.1 18.06H25.32L24.3 15.6H27.76L28.8 18.06H32.22L29.68 12.12H31.58L32.84 15.6H33.74L35 12.12H36.9L34.36 18.06H38.58L37.28 15.6H38.18L39.44 12.12H39.44V35.64H0.56V14.28H0ZM11.66 22.18ZM11.66 22.18L10.32 19.34L8.94 22.18H11.66ZM21.94 15.6H25.04L24.16 13.56H19.7L18.42 16.48H16.68L19.78 9.32H27.3L30.22 16.48H28.42L27.08 13.56H25.6L26.54 15.6H29.1L30.82 19.66L29.58 22.18H32.6L36.32 14.28L34.1 9.32H38.2L40 13.56L37.82 18.06L40 22.18H36.32L34.98 19.34H33.52L32.22 22.18H30.42L31.74 19.34L30.36 16.48H29.62L27.18 22.18H18.7L17.76 19.34H14.12L15.34 22.18H18.06L16.22 26.5H12.92L14.48 22.18H12.32L10.96 25.04H8.72L10.08 22.18H4.66L9.62 10.82L0 10.82L0 22.18H7.4L9.16 26.5H12.26L14.72 19.34L17.18 26.5H23.5L25.96 19.34L28.42 26.5H35.08L40 16.48V9.32H25.76L23.72 13.56H22.78L20.82 9.32H13.66L15.48 13.56H11.42L11.88 12.12H13.78V10.82H6.94V12.12H8.84L6.92 16.48H5.16L8.26 9.32H12.82L10.66 4.36H4.36L0 14.28V30.68H40V14.28H36.9L39.18 9.32H35.08L37.26 4.36H30.96L28.8 9.32H24.26L26.44 4.36H20.14L17.96 9.32H13.42L15.6 4.36H9.3L4.94 14.28H10.18L8.14 18.06H12.44L11.36 15.6H14.88L15.98 18.06H18.96L16.42 12.12H18.32L19.58 15.6H20.48L21.74 12.12H23.64L21.1 18.06H25.32L24.3 15.6H27.76L28.8 18.06H32.22L29.68 12.12H31.58L32.84 15.6H33.74L35 12.12H36.9L34.36 18.06H38.58L37.28 15.6H38.18L39.44 12.12H39.44V35.64H0.56V14.28H0Z" fill="white"/>
               </svg>
               <span className="text-[10px] font-bold text-neutral-500 bg-neutral-100 px-2 py-0.5 rounded-full border border-neutral-200">Coming Soon</span>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}