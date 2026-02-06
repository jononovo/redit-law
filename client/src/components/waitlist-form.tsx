import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Bot, User } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const formSchema = z.object({
  email: z.string().email({
    message: "Invalid email address.",
  }),
  name: z.string().min(2, {
    message: "Name must be at least 2 characters.",
  }),
});

export function WaitlistForm() {
  const { toast } = useToast();
  
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: "",
      name: "",
    },
  });

  function onSubmit(values: z.infer<typeof formSchema>) {
    toast({
      title: "ACCESS_REQUEST_RECEIVED",
      description: `Welcome to the queue, ${values.name}. We will notify ${values.email} upon activation.`,
    });
    console.log(values);
  }

  return (
    <section className="py-24 container mx-auto px-4 flex justify-center">
      <Card className="w-full max-w-lg bg-card border-primary/20 shadow-[0_0_50px_-12px_rgba(0,255,65,0.1)]">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-mono">INITIALIZE_REGISTRATION</CardTitle>
          <CardDescription>Join the waitlist to secure early access.</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="human" className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-8 bg-muted/50">
              <TabsTrigger value="human" className="data-[state=active]:bg-background data-[state=active]:text-primary font-mono">
                <User className="mr-2 h-4 w-4" /> HUMAN
              </TabsTrigger>
              <TabsTrigger value="bot" className="data-[state=active]:bg-background data-[state=active]:text-secondary font-mono">
                <Bot className="mr-2 h-4 w-4" /> BOT
              </TabsTrigger>
            </TabsList>
            
            <TabsContent value="human">
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="font-mono text-xs uppercase text-muted-foreground">User_Designation</FormLabel>
                        <FormControl>
                          <Input placeholder="Alice Smith" {...field} className="bg-background/50 font-mono" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="font-mono text-xs uppercase text-muted-foreground">Comms_Channel</FormLabel>
                        <FormControl>
                          <Input placeholder="alice@example.com" {...field} className="bg-background/50 font-mono" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <Button type="submit" className="w-full font-bold bg-primary text-primary-foreground hover:bg-primary/90">
                    REQUEST_ACCESS
                  </Button>
                </form>
              </Form>
            </TabsContent>
            
            <TabsContent value="bot">
              <div className="space-y-4 text-center py-4">
                <div className="font-mono text-sm text-secondary mb-4 p-4 border border-secondary/20 rounded bg-secondary/5">
                  <p>{`> DETECTING_API_HANDSHAKE...`}</p>
                  <p>{`> PROTOCOL: OPENCLAW_V1`}</p>
                </div>
                <p className="text-muted-foreground text-sm">
                  Bots can register programmatically via our API.
                </p>
                <div className="bg-black/50 p-4 rounded text-left font-mono text-xs text-muted-foreground overflow-x-auto">
                  <span className="text-purple-400">curl</span> -X POST https://api.creditclaw.com/v1/bots/register \<br/>
                  &nbsp;&nbsp;-H <span className="text-green-400">"Authorization: Bearer YOUR_API_KEY"</span> \<br/>
                  &nbsp;&nbsp;-d <span className="text-yellow-400">'&#123;"type": "claw_bot", "owner": "user_123"&#125;'</span>
                </div>
                <Button variant="secondary" className="w-full mt-4 font-bold">
                  GET_API_KEY
                </Button>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </section>
  );
}