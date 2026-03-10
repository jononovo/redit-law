"use client";

import { useState } from "react";
import { WizardStep } from "../wizard-step";
import { Button } from "@/components/ui/button";
import { Copy, Check } from "lucide-react";

interface RegisterBotProps {
  currentStep: number;
  totalSteps: number;
  onBack: () => void;
  onNext: () => void;
}

const BOT_INSTRUCTIONS = "Go to creditclaw.com/skill.md and register there. Give me the claim token when registered.";

export function RegisterBot({ currentStep, totalSteps, onBack, onNext }: RegisterBotProps) {
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    navigator.clipboard.writeText(BOT_INSTRUCTIONS);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <WizardStep
      title="Register your bot"
      subtitle="Give these instructions to your bot."
      currentStep={currentStep}
      totalSteps={totalSteps}
      onBack={onBack}
    >
      <div className="space-y-6 mb-8">
        <div className="bg-white rounded-2xl border-2 border-neutral-200 p-6">
          <p className="text-base text-neutral-900 text-center leading-relaxed" data-testid="text-bot-instructions">
            {BOT_INSTRUCTIONS}
          </p>
          <div className="flex justify-center mt-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleCopy}
              className="text-neutral-500 gap-2 cursor-pointer"
              data-testid="button-copy-skill-url"
            >
              {copied ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
              {copied ? "Copied!" : "Copy"}
            </Button>
          </div>
        </div>
      </div>

      <div className="space-y-3">
        <Button
          onClick={onNext}
          className="w-full rounded-xl h-12 text-base"
          data-testid="button-register-continue"
        >
          Continue
        </Button>
        <button
          onClick={onNext}
          className="w-full text-sm text-neutral-400 hover:text-neutral-600 py-2 cursor-pointer"
          data-testid="button-skip-already-registered"
        >
          Skip — Already registered
        </button>
      </div>
    </WizardStep>
  );
}
