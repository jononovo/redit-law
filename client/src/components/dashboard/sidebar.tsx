import { Link, useLocation } from "wouter";
import { 
  LayoutDashboard, 
  CreditCard, 
  Activity, 
  Settings, 
  LogOut,
  Plus
} from "lucide-react";
import logoClaw from "@/assets/images/logo-claw-chip.png";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const navItems = [
  { icon: LayoutDashboard, label: "Overview", href: "/app" },
  { icon: CreditCard, label: "Cards", href: "/app/cards" },
  { icon: Activity, label: "Transactions", href: "/app/transactions" },
  { icon: Settings, label: "Settings", href: "/app/settings" },
];

export function Sidebar() {
  const [location] = useLocation();

  return (
    <aside className="w-64 bg-white border-r border-neutral-100 h-screen fixed left-0 top-0 flex flex-col z-50">
      <div className="p-6 flex items-center gap-3">
        <img src={logoClaw} alt="CreditClaw" className="w-8 h-8 object-contain" />
        <span className="font-bold text-lg tracking-tight text-neutral-900">CreditClaw</span>
      </div>

      <div className="px-4 mb-6">
        <Button className="w-full justify-start gap-2 rounded-xl bg-primary hover:bg-primary/90 shadow-md shadow-primary/20">
            <Plus className="w-4 h-4" />
            <span>New Card</span>
        </Button>
      </div>

      <nav className="flex-1 px-4 space-y-1">
        {navItems.map((item) => {
          const isActive = location === item.href;
          return (
            <Link key={item.href} href={item.href}>
              <div className={cn(
                "flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all cursor-pointer",
                isActive 
                  ? "bg-neutral-900 text-white shadow-md shadow-neutral-900/10" 
                  : "text-neutral-500 hover:bg-neutral-50 hover:text-neutral-900"
              )}>
                <item.icon className={cn("w-5 h-5", isActive ? "text-white" : "text-neutral-400")} />
                {item.label}
              </div>
            </Link>
          );
        })}
      </nav>

      <div className="p-4 border-t border-neutral-100">
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-neutral-50 cursor-pointer transition-colors group">
            <div className="w-8 h-8 rounded-full bg-neutral-100 flex items-center justify-center text-neutral-500 group-hover:bg-white group-hover:shadow-sm">
                <LogOut className="w-4 h-4" />
            </div>
            <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-neutral-900 truncate">Log Out</p>
            </div>
        </div>
      </div>
    </aside>
  );
}
