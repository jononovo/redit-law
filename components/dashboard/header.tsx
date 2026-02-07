"use client";

import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuth } from "@/lib/auth/auth-context";
import { NotificationPopover } from "./notification-popover";

export function Header({ title }: { title: string }) {
  const { user } = useAuth();

  return (
    <header className="h-16 bg-white/80 backdrop-blur-md border-b border-neutral-100 sticky top-0 z-40 px-8 flex items-center justify-between">
      <h1 className="text-xl font-bold text-neutral-900">{title}</h1>

      <div className="flex items-center gap-4">
        <div className="relative w-64 hidden md:block">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
            <Input 
                placeholder="Search transactions..." 
                className="pl-9 h-10 rounded-full bg-neutral-50 border-transparent focus-visible:bg-white focus-visible:ring-primary/20 transition-all"
                data-testid="input-search"
            />
        </div>

        <NotificationPopover />

        <div className="h-8 w-px bg-neutral-200 mx-1" />

        <div className="flex items-center gap-3 pl-1">
            <div className="text-right hidden sm:block">
                <p className="text-sm font-medium text-neutral-900">{user?.displayName || "User"}</p>
                <p className="text-xs text-neutral-500">{user?.email || "Pro Plan"}</p>
            </div>
            <Avatar className="h-9 w-9 border-2 border-white shadow-sm cursor-pointer">
                <AvatarImage src={user?.photoURL || undefined} alt={user?.displayName || "User"} />
                <AvatarFallback className="bg-primary/10 text-primary font-bold">
                  {user?.displayName?.[0] || user?.email?.[0]?.toUpperCase() || "U"}
                </AvatarFallback>
            </Avatar>
        </div>
      </div>
    </header>
  );
}
