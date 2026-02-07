"use client";

import { useState } from "react";
import { WizardStep } from "../wizard-step";
import { Button } from "@/components/ui/button";
import { Bot, UserPlus } from "lucide-react";

interface ChoosePathProps {
  currentStep: number;
  totalSteps: number;
  onNext: (path: "bot-first" | "owner-first") => void;
}

export function ChoosePath({ currentStep, totalSteps, onNext }: ChoosePathProps) {
  const [selected, setSelected] = useState<"bot-first" | "owner-first" | null>(null);

  return (
    <WizardStep
      title="How would you like to connect your bot?"
      subtitle="Choose how to get started"
      currentStep={currentStep}
      totalSteps={totalSteps}
      showBack={false}
    >
      <div className="space-y-4 mb-8">
        <button
          onClick={() => setSelected("bot-first")}
          className={`w-full p-6 rounded-2xl border-2 text-left cursor-pointer transition-all ${
            selected === "bot-first"
              ? "border-primary bg-primary/5 shadow-sm"
              : "border-neutral-200 bg-white hover:border-neutral-300"
          }`}
          data-testid="option-bot-first"
        >
          <div className="flex items-start gap-4">
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
              selected === "bot-first" ? "bg-primary/10" : "bg-neutral-100"
            }`}>
              <Bot className={`w-6 h-6 ${selected === "bot-first" ? "text-primary" : "text-neutral-500"}`} />
            </div>
            <div>
              <p className="font-semibold text-neutral-900">My bot already registered</p>
              <p className="text-sm text-neutral-500 mt-1">I have a claim token from my bot</p>
            </div>
          </div>
        </button>

        <button
          onClick={() => setSelected("owner-first")}
          className={`w-full p-6 rounded-2xl border-2 text-left cursor-pointer transition-all ${
            selected === "owner-first"
              ? "border-primary bg-primary/5 shadow-sm"
              : "border-neutral-200 bg-white hover:border-neutral-300"
          }`}
          data-testid="option-owner-first"
        >
          <div className="flex items-start gap-4">
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
              selected === "owner-first" ? "bg-primary/10" : "bg-neutral-100"
            }`}>
              <UserPlus className={`w-6 h-6 ${selected === "owner-first" ? "text-primary" : "text-neutral-500"}`} />
            </div>
            <div>
              <p className="font-semibold text-neutral-900">I want to set up first</p>
              <p className="text-sm text-neutral-500 mt-1">I&apos;ll get a code to give my bot</p>
            </div>
          </div>
        </button>
      </div>

      {selected && (
        <Button
          onClick={() => onNext(selected)}
          className="w-full rounded-xl h-12 text-base"
          data-testid="button-continue"
        >
          Continue
        </Button>
      )}
    </WizardStep>
  );
}
