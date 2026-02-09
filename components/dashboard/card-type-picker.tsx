"use client";

import { CreditCard, ShieldCheck, Zap } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";

interface CardTypePickerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectSelfHosted: () => void;
}

const cardTypes = [
  {
    id: "self-hosted",
    title: "Self-Hosted",
    description: "Bring your own card. Your bot holds partial data, CreditClaw holds the rest. Neither can pay alone.",
    icon: ShieldCheck,
    available: true,
    color: "bg-emerald-50 text-emerald-600 border-emerald-200",
    hoverColor: "hover:border-emerald-400 hover:shadow-md hover:shadow-emerald-100",
  },
  {
    id: "virtual",
    title: "Virtual Card",
    description: "CreditClaw issues a virtual card for your bot with built-in spending controls.",
    icon: CreditCard,
    available: false,
    color: "bg-blue-50 text-blue-400 border-blue-100",
    hoverColor: "",
  },
  {
    id: "stripe-asp",
    title: "Stripe ASP",
    description: "Stripe-powered agentic checkout for seamless, merchant-integrated payments.",
    icon: Zap,
    available: false,
    color: "bg-purple-50 text-purple-400 border-purple-100",
    hoverColor: "",
  },
];

export function CardTypePicker({ open, onOpenChange, onSelectSelfHosted }: CardTypePickerProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Add a New Card</DialogTitle>
          <DialogDescription>
            Choose how you want your bot to handle payments.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 py-2">
          {cardTypes.map((type) => (
            <button
              key={type.id}
              onClick={() => {
                if (type.id === "self-hosted") {
                  onOpenChange(false);
                  onSelectSelfHosted();
                }
              }}
              disabled={!type.available}
              className={`relative flex items-start gap-4 p-4 rounded-xl border-2 text-left transition-all ${
                type.available
                  ? `${type.color} ${type.hoverColor} cursor-pointer`
                  : `${type.color} opacity-60 cursor-not-allowed`
              }`}
              data-testid={`button-card-type-${type.id}`}
            >
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${
                type.available ? "bg-white shadow-sm" : "bg-white/50"
              }`}>
                <type.icon className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-neutral-900">{type.title}</span>
                  {!type.available && (
                    <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-neutral-200 text-neutral-500">
                      Coming Soon
                    </span>
                  )}
                </div>
                <p className="text-sm text-neutral-500 mt-1 leading-relaxed">{type.description}</p>
              </div>
            </button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
