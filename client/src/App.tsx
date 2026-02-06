import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import Home from "@/pages/home";

function AnnouncementBar() {
  return (
    <div className="bg-neutral-900 text-white text-xs font-medium py-2 text-center fixed top-0 w-full z-[60]">
      <span>Launch: 11 February, 2026</span>
    </div>
  );
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <AnnouncementBar />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;