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

const BOT_INSTRUCTIONS = "Go to creditclaw.com/skill.md and register there.";

export function RegisterBot({ currentStep, totalSteps, onBack, onNext }: RegisterBotProps) {
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    navigator.clipboard.writeText(BOT_INSTRUCTIONS);
    setCopied(true);
  }

  return (
    <WizardStep
      title="Register your bot"
      subtitle="Give these instructions to your bot."
      currentStep={currentStep}
      totalSteps={totalSteps}
      onBack={onBack}
    >
      <div className="space-y-4 mb-8">
        <div className="bg-neutral-900 rounded-xl p-4">
          <code className="text-sm text-neutral-100 leading-relaxed block text-center" data-testid="text-bot-instructions">
            {BOT_INSTRUCTIONS}
          </code>
        </div>
        <Button
          onClick={handleCopy}
          variant={copied ? "outline" : "default"}
          className="w-full gap-2 cursor-pointer rounded-xl h-12 text-base"
          data-testid="button-copy-skill-url"
        >
          {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
          {copied ? "Copied!" : "Copy"}
        </Button>
      </div>

      <div className="space-y-3">
        <Button
          onClick={onNext}
          disabled={!copied}
          variant={copied ? "default" : "outline"}
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
          Skip — My bot already registered
        </button>
      </div>
    </WizardStep>
  );
}
