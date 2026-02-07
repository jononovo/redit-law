"use client";

import { useState } from "react";
import { WizardStep } from "../wizard-step";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, AlertCircle } from "lucide-react";

interface ClaimTokenProps {
  currentStep: number;
  totalSteps: number;
  onBack: () => void;
  onNext: (botId: string, botName: string) => void;
}

export function ClaimToken({ currentStep, totalSteps, onBack, onNext }: ClaimTokenProps) {
  const [token, setToken] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClaim() {
    if (!token.trim()) return;
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/v1/bots/claim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ claim_token: token.trim() }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Invalid claim token. Please check and try again.");
        setLoading(false);
        return;
      }

      onNext(data.bot_id, data.bot_name);
    } catch {
      setError("Something went wrong. Please try again.");
      setLoading(false);
    }
  }

  return (
    <WizardStep
      title="Enter your bot's claim token"
      subtitle="This was provided when your bot registered. Check your email if you're not sure."
      currentStep={currentStep}
      totalSteps={totalSteps}
      onBack={onBack}
    >
      <div className="space-y-4 mb-8">
        <Input
          value={token}
          onChange={(e) => { setToken(e.target.value); setError(null); }}
          placeholder="e.g. coral-X9K2"
          className="rounded-xl h-12 text-base"
          data-testid="input-claim-token"
          autoFocus
        />

        {error && (
          <div className="flex items-center gap-2 text-sm text-red-600">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            {error}
          </div>
        )}
      </div>

      <Button
        onClick={handleClaim}
        disabled={!token.trim() || loading}
        className="w-full rounded-xl h-12 text-base"
        data-testid="button-claim"
      >
        {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : "Claim Bot"}
      </Button>
    </WizardStep>
  );
}
