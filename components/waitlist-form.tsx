"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useEffect, useState } from "react";
import Image from "next/image";

const formSchema = z.object({
  email: z.string().email({
    message: "That doesn't look like a valid email.",
  }),
});

function Counter({ value }: { value: number }) {
  return <span>{value.toLocaleString()}</span>;
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
      title: "🎉 You're on the list!",
      description: "We'll let you know when your bot can start spending.",
    });
    setCount(c => c + 1);
    console.log(values);
  }

  return (
    <section className="py-24 bg-neutral-900 text-white relative overflow-hidden">
      
      <div className="absolute top-0 right-0 w-full h-full bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20" />
      <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-primary/20 rounded-full blur-[120px] pointer-events-none" />

      <div className="container mx-auto px-6 max-w-3xl text-center relative z-10">
        
        <div className="inline-block mb-8">
            <div className="px-6 py-2 rounded-full bg-white/10 backdrop-blur-md border border-white/20 font-medium flex items-center gap-3">
                 <div className="flex -space-x-2">
                    <div className="w-6 h-6 rounded-full bg-green-400 border-2 border-neutral-900" />
                    <div className="w-6 h-6 rounded-full bg-blue-400 border-2 border-neutral-900" />
                    <div className="w-6 h-6 rounded-full bg-orange-400 border-2 border-neutral-900" />
                 </div>
                 <span><Counter value={count} /> people waiting</span>
            </div>
        </div>

        <h2 className="text-4xl md:text-6xl font-extrabold tracking-tight mb-6">
            Ready to give your bot some purchasing power?
        </h2>
        <p className="text-xl text-neutral-400 mb-12 font-medium max-w-xl mx-auto">
            Join the waitlist today and be the first to know when we launch CreditClaw public beta.
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
                            placeholder="your@email.com" 
                            {...field} 
                            className="h-14 px-6 bg-white text-neutral-900 border-transparent rounded-full focus-visible:ring-primary text-lg placeholder:text-neutral-400"
                            data-testid="input-footer-email"
                        />
                    </FormControl>
                    <FormMessage />
                    </FormItem>
                )}
                />
                <Button type="submit" className="h-14 px-8 rounded-full bg-primary text-white hover:bg-primary/90 font-bold text-lg shadow-lg shadow-primary/25" data-testid="button-footer-submit">
                  Join the List
                </Button>
            </form>
        </Form>
        
        <div className="mt-24 pt-8 border-t border-white/10 flex flex-col md:flex-row justify-between items-center text-sm text-neutral-500 font-medium">
            <div className="flex items-center gap-2">
                <Image src="/images/logo-claw-chip.png" alt="CreditClaw Logo" width={32} height={32} className="object-contain" />
                <span>&copy; 2026 CreditClaw Inc.</span>
            </div>
            <div className="flex gap-8 mt-6 md:mt-0">
                <a href="#" className="hover:text-white transition-colors">Twitter</a>
                <a href="#" className="hover:text-white transition-colors">Instagram</a>
                <a href="#" className="hover:text-white transition-colors">TikTok</a>
            </div>
        </div>
      </div>
    </section>
  );
}
