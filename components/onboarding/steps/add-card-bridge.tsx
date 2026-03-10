"use client";

import { CreditCard, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { WizardStep } from "../wizard-step";

interface AddCardBridgeProps {
  currentStep: number;
  totalSteps: number;
  onBack: () => void;
  onNext: () => void;
  onSkip: () => void;
}

export function AddCardBridge({ currentStep, totalSteps, onBack, onNext, onSkip }: AddCardBridgeProps) {
  return (
    <WizardStep
      title="Ready to add your card?"
      subtitle="Set up your encrypted card so your bot can make purchases."
      currentStep={currentStep}
      totalSteps={totalSteps}
      onBack={onBack}
    >
      <div className="space-y-6">
        <div className="bg-white rounded-2xl border border-neutral-200 p-6 text-center space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto">
            <CreditCard className="w-7 h-7 text-primary" />
          </div>
          <div>
            <p className="text-sm text-neutral-600 leading-relaxed">
              Your card details are encrypted in your browser and never seen by CreditClaw.
              A disposable sub-agent decrypts at checkout, pays, and is deleted.
            </p>
          </div>
        </div>

        <Button
          onClick={onNext}
          className="w-full gap-2 cursor-pointer"
          data-testid="button-add-card-yes"
        >
          Yes, let's add a card
          <ArrowRight className="w-4 h-4" />
        </Button>

        <div className="text-center">
          <button
            onClick={onSkip}
            className="text-sm text-neutral-400 hover:text-neutral-600 py-2 cursor-pointer"
            data-testid="button-add-card-skip"
          >
            Skip — I'll do this later
          </button>
        </div>
      </div>
    </WizardStep>
  );
}
