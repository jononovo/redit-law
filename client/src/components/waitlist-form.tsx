import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { motion, useSpring, useTransform } from "framer-motion";
import { useEffect, useState } from "react";

const formSchema = z.object({
  email: z.string().email({
    message: "Invalid email.",
  }),
});

function Counter({ value }: { value: number }) {
  const spring = useSpring(value, { mass: 0.8, stiffness: 75, damping: 15 });
  const display = useTransform(spring, (current) => Math.round(current).toLocaleString());

  useEffect(() => {
    spring.set(value);
  }, [value, spring]);

  return <motion.span>{display}</motion.span>;
}

export function WaitlistForm() {
  const { toast } = useToast();
  const [count, setCount] = useState(14203);

  // Simulate live updates
  useEffect(() => {
    const interval = setInterval(() => {
      if (Math.random() > 0.7) {
        setCount(c => c + Math.floor(Math.random() * 3) + 1);
      }
    }, 2000);
    return () => clearInterval(interval);
  }, []);
  
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: "",
    },
  });

  function onSubmit(values: z.infer<typeof formSchema>) {
    toast({
      title: "REGISTERED",
      description: "We will contact you shortly.",
    });
    setCount(c => c + 1);
    console.log(values);
  }

  return (
    <section className="py-32 bg-black text-white relative overflow-hidden">
        {/* Subtle Gradient Spot */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-[hsl(var(--accent))] opacity-[0.03] blur-[100px] pointer-events-none rounded-full" />

      <div className="container mx-auto px-6 max-w-2xl text-center relative z-10">
        
        {/* Waitlist Counter */}
        <div className="mb-12 flex flex-col items-center gap-2">
            <div className="flex items-center gap-2 px-3 py-1 rounded-full border border-white/10 bg-white/5 backdrop-blur-sm">
                <div className="w-1.5 h-1.5 rounded-full bg-[hsl(var(--accent))] animate-pulse" />
                <span className="font-mono text-[10px] uppercase tracking-widest text-neutral-400">
                    Humans_Waiting
                </span>
            </div>
            <div className="font-mono text-5xl md:text-6xl font-light tracking-tighter text-white">
                <Counter value={count} />
            </div>
        </div>

        <h2 className="text-3xl font-light tracking-tight mb-6">
            Join the <span className="italic">Protocol</span>.
        </h2>
        <p className="text-neutral-500 mb-12 font-light">
            Early access is limited to developers and qualified bot operators.
        </p>

        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col md:flex-row gap-0 border border-white/10 p-1 bg-neutral-900/20 backdrop-blur-sm">
                <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                    <FormItem className="flex-1">
                    <FormControl>
                        <Input 
                            placeholder="ENTER_EMAIL_ADDRESS" 
                            {...field} 
                            className="bg-transparent border-none rounded-none h-12 px-4 font-mono text-sm placeholder:text-neutral-700 focus-visible:ring-0 text-white" 
                        />
                    </FormControl>
                    <FormMessage />
                    </FormItem>
                )}
                />
                <Button type="submit" className="rounded-none h-12 px-8 bg-white text-black hover:bg-neutral-200 font-mono text-xs uppercase tracking-wider">
                Request_Access
                </Button>
            </form>
        </Form>
        
        <div className="mt-16 pt-8 border-t border-white/5 flex justify-between items-center text-[10px] font-mono text-neutral-600 uppercase tracking-widest">
            <div>© 2024 CREDITCLAW</div>
            <div className="flex gap-4">
                <a href="#" className="hover:text-white transition-colors">Privacy</a>
                <a href="#" className="hover:text-white transition-colors">Terms</a>
            </div>
        </div>
      </div>
    </section>
  );
}