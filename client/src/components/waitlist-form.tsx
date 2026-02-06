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
    message: "Please enter a valid email address.",
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
      title: "Success",
      description: "You've been added to the waitlist.",
    });
    setCount(c => c + 1);
    console.log(values);
  }

  return (
    <section className="py-32 relative overflow-hidden">
      <div className="container mx-auto px-6 max-w-2xl text-center relative z-10">
        
        {/* Waitlist Counter */}
        <div className="mb-8 inline-flex items-center gap-3 px-4 py-2 rounded-full bg-white/5 border border-white/10 backdrop-blur-sm">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
            </span>
            <div className="text-sm font-medium text-muted-foreground">
                <span className="text-foreground font-semibold"><Counter value={count} /></span> people on the waitlist
            </div>
        </div>

        <h2 className="text-4xl md:text-5xl font-semibold tracking-tight mb-6">
            Ready to upgrade your bots?
        </h2>
        <p className="text-xl text-muted-foreground mb-12">
            Join the waitlist to get early access to CreditClaw and start issuing cards to your AI agents.
        </p>

        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col sm:flex-row gap-4 max-w-md mx-auto">
                <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                    <FormItem className="flex-1">
                    <FormControl>
                        <Input 
                            placeholder="name@company.com" 
                            {...field} 
                            className="h-12 px-4 bg-white/5 border-white/10 rounded-lg focus-visible:ring-blue-500 text-base" 
                        />
                    </FormControl>
                    <FormMessage />
                    </FormItem>
                )}
                />
                <Button type="submit" className="h-12 px-8 rounded-lg bg-blue-600 text-white hover:bg-blue-700 font-medium text-base">
                  Join Waitlist
                </Button>
            </form>
        </Form>
        
        <div className="mt-20 pt-8 border-t border-white/5 flex flex-col md:flex-row justify-between items-center text-sm text-muted-foreground">
            <div>© 2026 CreditClaw Inc. All rights reserved.</div>
            <div className="flex gap-6 mt-4 md:mt-0">
                <a href="#" className="hover:text-foreground transition-colors">Privacy Policy</a>
                <a href="#" className="hover:text-foreground transition-colors">Terms of Service</a>
                <a href="#" className="hover:text-foreground transition-colors">Contact</a>
            </div>
        </div>
      </div>
    </section>
  );
}