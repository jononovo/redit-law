"use client";

import { useState, useMemo, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import { ChoosePath } from "./steps/choose-path";
import { ClaimToken } from "./steps/claim-token";
import { PairingCode } from "./steps/pairing-code";
import { SpendingLimits } from "./steps/spending-limits";
import { ConnectBot } from "./steps/connect-bot";
import { SignInStep } from "./steps/sign-in";
import { AddCardPrompt } from "./steps/add-card-prompt";
import { CardEntry } from "./steps/card-entry";
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
  fundedAmountCents: number;
  isAuthenticated: boolean;
  wantsCard: boolean;
  cardAdded: boolean;
}

type StepId =
  | "choose-path"
  | "sign-in"
  | "claim-token"
  | "pairing-code"
  | "spending-limits"
  | "connect-bot"
  | "add-card-prompt"
  | "card-entry"
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
  fundedAmountCents: 0,
  isAuthenticated: false,
  wantsCard: false,
  cardAdded: false,
};

export function OnboardingWizard() {
  const router = useRouter();
  const [state, setState] = useState<WizardState>(initialState);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [transitionClass, setTransitionClass] = useState("wizard-step-active");

  const activeSteps = useMemo<StepId[]>(() => {
    const steps: StepId[] = ["choose-path"];

    steps.push("sign-in");

    if (state.entryPath === "bot-first") {
      steps.push("claim-token");
    } else if (state.entryPath === "owner-first") {
      steps.push("pairing-code");
    }

    steps.push("spending-limits");

    if (!state.botConnected) {
      steps.push("connect-bot");
    }

    steps.push("add-card-prompt");

    if (state.wantsCard) {
      steps.push("card-entry");
    }

    steps.push("complete");

    return steps;
  }, [state.entryPath, state.botConnected, state.wantsCard]);

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

  const goToComplete = useCallback(() => {
    animateTransition("forward", () => {
      const completeIndex = activeSteps.indexOf("complete");
      if (completeIndex !== -1) {
        setCurrentStepIndex(completeIndex);
      } else {
        setCurrentStepIndex(activeSteps.length - 1);
      }
    });
  }, [animateTransition, activeSteps]);

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

      case "sign-in":
        return (
          <SignInStep
            currentStep={currentStepIndex}
            totalSteps={totalSteps}
            onBack={goBack}
            onNext={() => {
              setState((s) => ({ ...s, isAuthenticated: true }));
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

      case "add-card-prompt":
        return (
          <AddCardPrompt
            currentStep={currentStepIndex}
            totalSteps={totalSteps}
            onBack={goBack}
            onNext={() => {
              setState((s) => ({ ...s, wantsCard: true }));
              goForward();
            }}
            onSkip={goToComplete}
          />
        );

      case "card-entry":
        return (
          <CardEntry
            currentStep={currentStepIndex}
            totalSteps={totalSteps}
            onBack={goBack}
            onNext={() => {
              setState((s) => ({ ...s, cardAdded: true }));
              goForward();
            }}
            botId={state.botId || undefined}
            botName={state.botName || undefined}
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
          onClick={() => router.push("/overview")}
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
