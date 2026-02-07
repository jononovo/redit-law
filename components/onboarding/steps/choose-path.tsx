"use client";

import { WizardStep } from "../wizard-step";
import { Bot, UserPlus } from "lucide-react";

interface ChoosePathProps {
  currentStep: number;
  totalSteps: number;
  onNext: (path: "bot-first" | "owner-first") => void;
}

export function ChoosePath({ currentStep, totalSteps, onNext }: ChoosePathProps) {
  return (
    <WizardStep
      title="How would you like to connect your bot?"
      subtitle="Choose how to get started"
      currentStep={currentStep}
      totalSteps={totalSteps}
      showBack={false}
    >
      <div className="space-y-4">
        <button
          onClick={() => onNext("bot-first")}
          className="w-full p-6 rounded-2xl border-2 border-neutral-200 bg-white hover:border-primary hover:bg-primary/5 text-left cursor-pointer transition-all"
          data-testid="option-bot-first"
        >
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-neutral-100">
              <Bot className="w-6 h-6 text-neutral-500" />
            </div>
            <div>
              <p className="font-semibold text-neutral-900">My bot already registered</p>
              <p className="text-sm text-neutral-500 mt-1">I have a claim token from my bot</p>
            </div>
          </div>
        </button>

        <button
          onClick={() => onNext("owner-first")}
          className="w-full p-6 rounded-2xl border-2 border-neutral-200 bg-white hover:border-primary hover:bg-primary/5 text-left cursor-pointer transition-all"
          data-testid="option-owner-first"
        >
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-neutral-100">
              <UserPlus className="w-6 h-6 text-neutral-500" />
            </div>
            <div>
              <p className="font-semibold text-neutral-900">I want to set up first</p>
              <p className="text-sm text-neutral-500 mt-1">I&apos;ll get a code to give my bot</p>
            </div>
          </div>
        </button>
      </div>
    </WizardStep>
  );
}
