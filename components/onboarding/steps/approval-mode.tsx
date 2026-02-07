"use client";

import { useState } from "react";
import { WizardStep } from "../wizard-step";
import { Button } from "@/components/ui/button";
import { ShieldCheck, Zap, Tag } from "lucide-react";

type ApprovalMode = "ask_for_everything" | "auto_approve_under_threshold" | "auto_approve_by_category";

interface ApprovalModeProps {
  currentStep: number;
  totalSteps: number;
  onBack: () => void;
  onNext: (mode: ApprovalMode) => void;
  defaultMode: ApprovalMode;
}

const options: { value: ApprovalMode; label: string; subtitle: string; Icon: typeof ShieldCheck }[] = [
  { value: "ask_for_everything", label: "Ask me every time", subtitle: "Most secure. You approve every transaction.", Icon: ShieldCheck },
  { value: "auto_approve_under_threshold", label: "Auto-approve small purchases", subtitle: "You only get asked for bigger ones.", Icon: Zap },
  { value: "auto_approve_by_category", label: "Auto-approve by category", subtitle: "You pick what's okay, everything else needs approval.", Icon: Tag },
];

export function ApprovalMode({ currentStep, totalSteps, onBack, onNext, defaultMode }: ApprovalModeProps) {
  const [selected, setSelected] = useState<ApprovalMode>(defaultMode);

  return (
    <WizardStep
      title="How should your bot handle purchases?"
      subtitle="You can always change this later from the dashboard."
      currentStep={currentStep}
      totalSteps={totalSteps}
      onBack={onBack}
    >
      <div className="space-y-3 mb-8">
        {options.map(({ value, label, subtitle, Icon }) => (
          <button
            key={value}
            onClick={() => setSelected(value)}
            className={`w-full p-5 rounded-2xl border-2 text-left cursor-pointer transition-all ${
              selected === value
                ? "border-primary bg-primary/5 shadow-sm"
                : "border-neutral-200 bg-white hover:border-neutral-300"
            }`}
            data-testid={`option-${value}`}
          >
            <div className="flex items-start gap-4">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                selected === value ? "bg-primary/10" : "bg-neutral-100"
              }`}>
                <Icon className={`w-5 h-5 ${selected === value ? "text-primary" : "text-neutral-500"}`} />
              </div>
              <div>
                <p className="font-semibold text-neutral-900">{label}</p>
                <p className="text-sm text-neutral-500 mt-0.5">{subtitle}</p>
              </div>
            </div>
          </button>
        ))}
      </div>

      <Button
        onClick={() => onNext(selected)}
        className="w-full rounded-xl h-12 text-base"
        data-testid="button-continue"
      >
        Continue
      </Button>
    </WizardStep>
  );
}
