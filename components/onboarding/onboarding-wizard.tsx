"use client";

import { useState, useMemo, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import { ChoosePath } from "./steps/choose-path";
import { ClaimToken } from "./steps/claim-token";
import { PairingCode } from "./steps/pairing-code";
import { SpendingLimits } from "./steps/spending-limits";
import { ConnectBot } from "./steps/connect-bot";
import { AddPayment } from "./steps/add-payment";
import { FundWallet } from "./steps/fund-wallet";
import { Complete } from "./steps/complete";

interface WizardState {
  entryPath: "owner-first" | "bot-first" | null;
  botId: string | null;
  botName: string | null;
  botConnected: boolean;
  pairingCode: string | null;
  perTransactionCents: number;
  dailyCents: number;
  monthlyCents: number;
  paymentMethodAdded: boolean;
  fundedAmountCents: number;
}

type StepId =
  | "choose-path"
  | "claim-token"
  | "pairing-code"
  | "spending-limits"
  | "connect-bot"
  | "add-payment"
  | "fund-wallet"
  | "complete";

const initialState: WizardState = {
  entryPath: null,
  botId: null,
  botName: null,
  botConnected: false,
  pairingCode: null,
  perTransactionCents: 2500,
  dailyCents: 5000,
  monthlyCents: 50000,
  paymentMethodAdded: false,
  fundedAmountCents: 0,
};

export function OnboardingWizard() {
  const router = useRouter();
  const [state, setState] = useState<WizardState>(initialState);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [transitionClass, setTransitionClass] = useState("wizard-step-active");

  const activeSteps = useMemo<StepId[]>(() => {
    const steps: StepId[] = ["choose-path"];

    if (state.entryPath === "bot-first") {
      steps.push("claim-token");
    } else if (state.entryPath === "owner-first") {
      steps.push("pairing-code");
    }

    steps.push("spending-limits");

    if (!state.botConnected) {
      steps.push("connect-bot");
    }

    steps.push("add-payment");

    if (state.paymentMethodAdded) {
      steps.push("fund-wallet");
    }

    steps.push("complete");

    return steps;
  }, [state.entryPath, state.botConnected, state.paymentMethodAdded]);

  const animateTransition = useCallback((direction: "forward" | "back", callback: () => void) => {
    setTransitionClass(direction === "forward" ? "wizard-step-exit" : "wizard-step-exit-back");
    setTimeout(() => {
      callback();
      setTransitionClass(direction === "forward" ? "wizard-step-enter" : "wizard-step-enter-back");
      setTimeout(() => {
        setTransitionClass("wizard-step-active");
      }, 20);
    }, 200);
  }, []);

  const goForward = useCallback(() => {
    animateTransition("forward", () => {
      setCurrentStepIndex((prev) => Math.min(prev + 1, activeSteps.length - 1));
    });
  }, [animateTransition, activeSteps.length]);

  const goBack = useCallback(() => {
    animateTransition("back", () => {
      setCurrentStepIndex((prev) => Math.max(prev - 1, 0));
    });
  }, [animateTransition]);

  useEffect(() => {
    setCurrentStepIndex((prev) => Math.min(prev, activeSteps.length - 1));
  }, [activeSteps.length]);

  const currentStep = activeSteps[currentStepIndex];
  const totalSteps = activeSteps.length;

  function renderStep() {
    switch (currentStep) {
      case "choose-path":
        return (
          <ChoosePath
            currentStep={currentStepIndex}
            totalSteps={totalSteps}
            onNext={(path) => {
              setState((s) => ({ ...s, entryPath: path }));
              goForward();
            }}
          />
        );

      case "claim-token":
        return (
          <ClaimToken
            currentStep={currentStepIndex}
            totalSteps={totalSteps}
            onBack={goBack}
            onNext={(botId, botName) => {
              setState((s) => ({ ...s, botId, botName, botConnected: true }));
              goForward();
            }}
          />
        );

      case "pairing-code":
        return (
          <PairingCode
            currentStep={currentStepIndex}
            totalSteps={totalSteps}
            onBack={goBack}
            onNext={(botId, botName) => {
              setState((s) => ({ ...s, botId, botName, botConnected: true }));
              goForward();
            }}
            onSkip={() => {
              setState((s) => ({ ...s, botConnected: false }));
              goForward();
            }}
            pairingCode={state.pairingCode}
            onCodeGenerated={(code) => setState((s) => ({ ...s, pairingCode: code }))}
          />
        );

      case "spending-limits":
        return (
          <SpendingLimits
            currentStep={currentStepIndex}
            totalSteps={totalSteps}
            onBack={goBack}
            onNext={(perTx, daily, monthly) => {
              setState((s) => ({ ...s, perTransactionCents: perTx, dailyCents: daily, monthlyCents: monthly }));
              goForward();
            }}
            defaultPerTx={state.perTransactionCents}
            defaultDaily={state.dailyCents}
            defaultMonthly={state.monthlyCents}
          />
        );

      case "connect-bot":
        return (
          <ConnectBot
            currentStep={currentStepIndex}
            totalSteps={totalSteps}
            onBack={goBack}
            onNext={(botId, botName) => {
              setState((s) => ({ ...s, botId, botName, botConnected: true }));
              goForward();
            }}
            onSkip={goForward}
            pairingCode={state.pairingCode}
          />
        );

      case "add-payment":
        return (
          <AddPayment
            currentStep={currentStepIndex}
            totalSteps={totalSteps}
            onBack={goBack}
            onNext={(added) => {
              setState((s) => ({ ...s, paymentMethodAdded: added }));
              goForward();
            }}
          />
        );

      case "fund-wallet":
        return (
          <FundWallet
            currentStep={currentStepIndex}
            totalSteps={totalSteps}
            onBack={goBack}
            onNext={(amountCents) => {
              setState((s) => ({ ...s, fundedAmountCents: amountCents }));
              goForward();
            }}
          />
        );

      case "complete":
        return (
          <Complete
            currentStep={currentStepIndex}
            totalSteps={totalSteps}
            state={state}
          />
        );

      default:
        return null;
    }
  }

  return (
    <>
      <style jsx global>{`
        .wizard-step-active {
          opacity: 1;
          transform: translateX(0);
          transition: opacity 0.25s ease, transform 0.25s ease;
        }
        .wizard-step-enter {
          opacity: 0;
          transform: translateX(30px);
        }
        .wizard-step-enter-back {
          opacity: 0;
          transform: translateX(-30px);
        }
        .wizard-step-exit {
          opacity: 0;
          transform: translateX(-30px);
          transition: opacity 0.15s ease, transform 0.15s ease;
        }
        .wizard-step-exit-back {
          opacity: 0;
          transform: translateX(30px);
          transition: opacity 0.15s ease, transform 0.15s ease;
        }
      `}</style>
      <div className="relative">
        <button
          onClick={() => router.push("/app")}
          className="absolute top-4 right-4 z-20 p-2 rounded-full bg-white/80 hover:bg-neutral-100 text-neutral-500 hover:text-neutral-900 transition-colors shadow-sm border border-neutral-200"
          aria-label="Close wizard"
          data-testid="button-close-wizard"
        >
          <X className="w-5 h-5" />
        </button>
        <div className={transitionClass}>
          {renderStep()}
        </div>
      </div>
    </>
  );
}
