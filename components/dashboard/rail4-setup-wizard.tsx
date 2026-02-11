"use client";

import { useState, useRef, useEffect } from "react";
import { Shield, Download, CheckCircle2, Loader2, ArrowRight, ArrowLeft, CreditCard, Sparkles, Tag } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { authFetch } from "@/lib/auth-fetch";

interface SetupWizardProps {
  botId?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onComplete: () => void;
}

interface InitData {
  decoy_filename: string;
  real_profile_index: number;
  missing_digit_positions: number[];
}

interface ActivationResult {
  payment_profiles_filename: string;
  payment_profiles_content: string;
}

const USE_CASE_OPTIONS = [
  { value: "personal", label: "Specific personal requests", icon: "🛍️" },
  { value: "takeout", label: "Take-out & impulse purchases", icon: "🍕" },
  { value: "business", label: "Business ordering & purchases", icon: "💼" },
  { value: "autonomous", label: "Autonomous online building: hosting, SaaS, API credits", icon: "🤖" },
  { value: "not_sure", label: "Not sure yet", icon: "🤔" },
  { value: "other", label: "Other", icon: "✏️" },
];

const SAMPLE_CARD_NUMBER = "4532 8219 0647 3851";
const SAMPLE_CARD_DIGITS = SAMPLE_CARD_NUMBER.replace(/\s/g, "").split("");

function StepIndicator({ current, total }: { current: number; total: number }) {
  return (
    <div className="flex items-center justify-center gap-2 mb-8" data-testid="step-indicator">
      {Array.from({ length: total }, (_, i) => (
        <div key={i} className="flex items-center gap-2">
          <div
            className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all duration-300 ${
              i < current
                ? "bg-green-500 text-white"
                : i === current
                  ? "bg-primary text-white shadow-lg shadow-primary/30 scale-110"
                  : "bg-neutral-100 text-neutral-400"
            }`}
          >
            {i < current ? <CheckCircle2 className="w-4 h-4" /> : i + 1}
          </div>
          {i < total - 1 && (
            <div className={`w-8 h-0.5 transition-colors duration-300 ${i < current ? "bg-green-500" : "bg-neutral-200"}`} />
          )}
        </div>
      ))}
    </div>
  );
}

type ActiveField = "digit0" | "digit1" | "digit2" | "month" | "year" | "zip" | "done";

function getActiveField(digits: string[], expiryMonth: string, expiryYear: string, zip: string): ActiveField {
  if (!digits[0]) return "digit0";
  if (!digits[1]) return "digit1";
  if (!digits[2]) return "digit2";
  if (!expiryMonth) return "month";
  if (!expiryYear) return "year";
  if (!zip.trim()) return "zip";
  return "done";
}

const MONTHS = Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, "0"));
const currentYear = new Date().getFullYear();
const YEARS = Array.from({ length: 12 }, (_, i) => String(currentYear + i));

function InteractiveCard({
  missingPositions,
  missingDigits,
  onDigitChange,
  expiryMonth,
  expiryYear,
  onExpiryMonthChange,
  onExpiryYearChange,
  activeField,
}: {
  missingPositions: number[];
  missingDigits: string;
  onDigitChange: (val: string) => void;
  expiryMonth: string;
  expiryYear: string;
  onExpiryMonthChange: (val: string) => void;
  onExpiryYearChange: (val: string) => void;
  activeField: ActiveField;
}) {
  const digitRefs = useRef<(HTMLInputElement | null)[]>([]);
  const monthRef = useRef<HTMLSelectElement>(null);
  const yearRef = useRef<HTMLSelectElement>(null);

  const digits = missingDigits.split("");
  while (digits.length < 3) digits.push("");

  useEffect(() => {
    if (activeField === "digit0") digitRefs.current[0]?.focus();
    else if (activeField === "digit1") digitRefs.current[1]?.focus();
    else if (activeField === "digit2") digitRefs.current[2]?.focus();
    else if (activeField === "month") monthRef.current?.focus();
    else if (activeField === "year") yearRef.current?.focus();
  }, [activeField]);

  function handleDigitInput(index: number, value: string) {
    const cleaned = value.replace(/\D/g, "").slice(0, 1);
    const newDigits = [...digits];
    newDigits[index] = cleaned;
    onDigitChange(newDigits.join(""));
  }

  function handleDigitKeyDown(index: number, e: React.KeyboardEvent) {
    if (e.key === "Backspace" && !digits[index] && index > 0) {
      const newDigits = [...digits];
      newDigits[index - 1] = "";
      onDigitChange(newDigits.join(""));
      digitRefs.current[index - 1]?.focus();
    }
  }

  function digitBorderClass(index: number) {
    const fieldName = `digit${index}` as ActiveField;
    if (digits[index]) return "border-green-400 bg-green-400/20";
    if (activeField === fieldName) return "border-amber-300 bg-white/20 ring-2 ring-amber-300/50 scale-110";
    return "border-amber-200/60 bg-white/10";
  }

  const isMonthActive = activeField === "month";
  const isYearActive = activeField === "year";
  const monthFilled = !!expiryMonth;
  const yearFilled = !!expiryYear;

  function renderCardNumber() {
    const groups: React.ReactNode[][] = [[], [], [], []];
    let missingIdx = 0;

    SAMPLE_CARD_DIGITS.forEach((digit, i) => {
      const groupIdx = Math.floor(i / 4);
      const isMissing = missingPositions.includes(i);

      if (isMissing) {
        const currentMissingIdx = missingIdx;
        groups[groupIdx].push(
          <input
            key={i}
            ref={(el) => { digitRefs.current[currentMissingIdx] = el; }}
            type="text"
            inputMode="numeric"
            maxLength={1}
            value={digits[currentMissingIdx] || ""}
            onChange={(e) => handleDigitInput(currentMissingIdx, e.target.value)}
            onKeyDown={(e) => handleDigitKeyDown(currentMissingIdx, e)}
            className={`w-[1.4em] h-[1.6em] text-center border-2 rounded text-white font-mono text-inherit focus:outline-none placeholder:text-white/40 caret-amber-300 transition-all duration-200 ${digitBorderClass(currentMissingIdx)}`}
            placeholder="?"
            data-testid={`input-card-digit-${currentMissingIdx}`}
            autoComplete="off"
          />
        );
        missingIdx++;
      } else {
        groups[groupIdx].push(
          <span key={i} className="text-white/80">{digit}</span>
        );
      }
    });

    return (
      <div className="flex gap-4 items-center justify-center">
        {groups.map((group, gi) => (
          <div key={gi} className="flex gap-[2px] font-mono text-xl tracking-wide">
            {group}
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="relative mx-auto" style={{ maxWidth: 480 }}>
      <div
        className="relative w-full rounded-2xl overflow-hidden shadow-2xl"
        style={{
          aspectRatio: "1.586",
          background: "linear-gradient(135deg, #1a1a2e 0%, #16213e 40%, #0f3460 100%)",
        }}
        data-testid="interactive-card"
      >
        <div
          className="absolute inset-0 opacity-10"
          style={{
            backgroundImage: "radial-gradient(circle at 20% 50%, rgba(255,255,255,0.3) 0%, transparent 50%), radial-gradient(circle at 80% 20%, rgba(255,255,255,0.2) 0%, transparent 40%)",
          }}
        />

        <div className="relative h-full flex flex-col justify-between p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-10 h-7 rounded bg-gradient-to-br from-amber-300 to-amber-500 flex items-center justify-center">
                <div className="w-6 h-4 rounded-sm border border-amber-600/30 bg-gradient-to-br from-amber-200 to-amber-400" />
              </div>
              <div className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center">
                <CreditCard className="w-3.5 h-3.5 text-white/50" />
              </div>
            </div>
            <span className="text-white/40 text-xs font-medium tracking-widest uppercase">CreditClaw</span>
          </div>

          <div className="flex-1 flex items-center">
            {renderCardNumber()}
          </div>

          <div className="flex items-end justify-end">
            <div className="text-right">
              <p className="text-[10px] text-white/40 uppercase tracking-wider mb-1">Expires</p>
              <div className="flex items-center gap-1">
                <select
                  ref={monthRef}
                  value={expiryMonth}
                  onChange={(e) => {
                    onExpiryMonthChange(e.target.value);
                  }}
                  className={`bg-transparent border-b-2 text-white text-sm font-medium text-center focus:outline-none appearance-none cursor-pointer px-1 pb-0.5 transition-all duration-200 ${
                    monthFilled
                      ? "border-green-400"
                      : isMonthActive
                        ? "border-amber-300 ring-1 ring-amber-300/50"
                        : "border-amber-200/60"
                  }`}
                  data-testid="select-card-expiry-month"
                >
                  <option value="" className="bg-neutral-800 text-white">MM</option>
                  {MONTHS.map(m => (
                    <option key={m} value={m} className="bg-neutral-800 text-white">{m}</option>
                  ))}
                </select>
                <span className="text-white/40 text-sm">/</span>
                <select
                  ref={yearRef}
                  value={expiryYear}
                  onChange={(e) => {
                    onExpiryYearChange(e.target.value);
                  }}
                  className={`bg-transparent border-b-2 text-white text-sm font-medium text-center focus:outline-none appearance-none cursor-pointer px-1 pb-0.5 transition-all duration-200 ${
                    yearFilled
                      ? "border-green-400"
                      : isYearActive
                        ? "border-amber-300 ring-1 ring-amber-300/50"
                        : "border-amber-200/60"
                  }`}
                  data-testid="select-card-expiry-year"
                >
                  <option value="" className="bg-neutral-800 text-white">YYYY</option>
                  {YEARS.map(y => (
                    <option key={y} value={y} className="bg-neutral-800 text-white">{y}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 justify-center mt-4">
        {missingPositions.map((pos, i) => (
          <div
            key={pos}
            className={`text-xs px-3 py-1.5 rounded-full font-medium transition-colors ${
              digits[i]
                ? "bg-green-100 text-green-700"
                : "bg-amber-100 text-amber-700 animate-pulse"
            }`}
          >
            Position {pos + 1}: {digits[i] ? <span className="font-bold">{digits[i]}</span> : "needed"}
          </div>
        ))}
      </div>
    </div>
  );
}

export function Rail4SetupWizard({ botId: initialBotId, open, onOpenChange, onComplete }: SetupWizardProps) {
  const { toast } = useToast();
  const isNewMode = !initialBotId;
  const stepOffset = isNewMode ? 2 : 0;
  const totalSteps = isNewMode ? 7 : 5;

  const [step, setStep] = useState(0);
  const [createdBotId, setCreatedBotId] = useState<string | null>(null);
  const activeBotId = initialBotId || createdBotId;

  const [cardName, setCardName] = useState("");
  const [useCase, setUseCase] = useState("");
  const [otherUseCase, setOtherUseCase] = useState("");
  const [createLoading, setCreateLoading] = useState(false);

  const [initLoading, setInitLoading] = useState(false);
  const [initData, setInitData] = useState<InitData | null>(null);
  const [missingDigits, setMissingDigits] = useState("");
  const [expiryMonth, setExpiryMonth] = useState("");
  const [expiryYear, setExpiryYear] = useState("");
  const [ownerZip, setOwnerZip] = useState("");
  const [submitLoading, setSubmitLoading] = useState(false);
  const [activationResult, setActivationResult] = useState<ActivationResult | null>(null);
  const [downloaded, setDownloaded] = useState(false);
  const zipRef = useRef<HTMLInputElement>(null);

  const [permAllowanceDuration, setPermAllowanceDuration] = useState("week");
  const [permAllowanceValue, setPermAllowanceValue] = useState("50");
  const [permExemptLimit, setPermExemptLimit] = useState("10");
  const [permHumanPermission, setPermHumanPermission] = useState("all");

  const digitsArr = missingDigits.split("");
  while (digitsArr.length < 3) digitsArr.push("");
  const activeField = getActiveField(digitsArr, expiryMonth, expiryYear, ownerZip);

  const cardDetailsStep = stepOffset + 1;

  useEffect(() => {
    if (activeField === "zip" && step === cardDetailsStep) {
      zipRef.current?.focus();
    }
  }, [activeField, step, cardDetailsStep]);

  useEffect(() => {
    if (!open) {
      setStep(0);
      setCreatedBotId(null);
      setCardName("");
      setUseCase("");
      setOtherUseCase("");
      setInitData(null);
      setMissingDigits("");
      setExpiryMonth("");
      setExpiryYear("");
      setOwnerZip("");
      setActivationResult(null);
      setDownloaded(false);
      setPermAllowanceDuration("week");
      setPermAllowanceValue("50");
      setPermExemptLimit("10");
      setPermHumanPermission("all");
    }
  }, [open]);

  async function handleCreateAndInitialize() {
    setCreateLoading(true);
    try {
      const createRes = await authFetch("/api/v1/rail4/create-bot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bot_name: cardName.trim() }),
      });
      if (!createRes.ok) {
        const err = await createRes.json().catch(() => ({}));
        throw new Error(err.message || "Failed to create card agent");
      }
      const createData = await createRes.json();
      const newBotId = createData.bot_id;
      setCreatedBotId(newBotId);

      const initRes = await authFetch("/api/v1/rail4/initialize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bot_id: newBotId }),
      });
      if (!initRes.ok) {
        const err = await initRes.json().catch(() => ({}));
        throw new Error(err.message || "Failed to initialize card");
      }
      const data = await initRes.json();
      setInitData({
        decoy_filename: data.decoy_filename,
        real_profile_index: data.real_profile_index,
        missing_digit_positions: data.missing_digit_positions,
      });
      setStep(stepOffset);
    } catch (err: any) {
      toast({ title: "Setup failed", description: err.message || "Please try again.", variant: "destructive" });
    } finally {
      setCreateLoading(false);
    }
  }

  async function handleInitialize() {
    if (!activeBotId) return;
    setInitLoading(true);
    try {
      const res = await authFetch("/api/v1/rail4/initialize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bot_id: activeBotId }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || "Failed to initialize");
      }
      const data = await res.json();
      setInitData({
        decoy_filename: data.decoy_filename,
        real_profile_index: data.real_profile_index,
        missing_digit_positions: data.missing_digit_positions,
      });
      setStep(stepOffset + 1);
    } catch (err: any) {
      toast({ title: "Setup failed", description: err.message || "Please try again.", variant: "destructive" });
    } finally {
      setInitLoading(false);
    }
  }

  const cardDetailsComplete = missingDigits.length >= 3 && !!expiryMonth && !!expiryYear;

  async function handleActivate() {
    if (!activeBotId) return;
    if (missingDigits.length !== 3) {
      toast({ title: "Missing digits", description: "Enter all 3 missing card digits.", variant: "destructive" });
      return;
    }
    if (!expiryMonth || !expiryYear) {
      toast({ title: "Expiry required", description: "Enter the card expiry date.", variant: "destructive" });
      return;
    }
    setSubmitLoading(true);
    try {
      const res = await authFetch("/api/v1/rail4/submit-owner-data", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bot_id: activeBotId,
          missing_digits: missingDigits,
          expiry_month: parseInt(expiryMonth),
          expiry_year: parseInt(expiryYear),
          owner_zip: ownerZip.trim() || "00000",
          profile_permissions: {
            profile_index: initData?.real_profile_index || 1,
            allowance_duration: permAllowanceDuration,
            allowance_currency: "USD",
            allowance_value: parseFloat(permAllowanceValue) || 50,
            confirmation_exempt_limit: parseFloat(permExemptLimit) || 0,
            human_permission_required: permHumanPermission,
            creditclaw_permission_required: "all",
          },
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || err.error || "Failed to activate");
      }
      const data = await res.json();
      setActivationResult({
        payment_profiles_filename: data.payment_profiles_filename,
        payment_profiles_content: data.payment_profiles_content,
      });
      setStep(stepOffset + 3);
    } catch (err: any) {
      toast({ title: "Activation failed", description: err.message || "Please check your details and try again.", variant: "destructive" });
    } finally {
      setSubmitLoading(false);
    }
  }

  function handleDownload() {
    if (!activationResult?.payment_profiles_content) return;
    const blob = new Blob([activationResult.payment_profiles_content], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = activationResult.payment_profiles_filename || "payment_profiles.md";
    a.click();
    URL.revokeObjectURL(url);
    setDownloaded(true);
  }

  const allSteps: React.ReactNode[] = [];

  if (isNewMode) {
    allSteps.push(
      <div key="card-name" className="flex flex-col items-center text-center px-4 py-2" data-testid="wizard-step-card-name">
        <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-primary/20 to-orange-100 flex items-center justify-center mb-6">
          <CreditCard className="w-10 h-10 text-primary" />
        </div>
        <h2 className="text-2xl font-bold text-neutral-900 mb-3">Add a New Card</h2>
        <p className="text-neutral-500 max-w-md leading-relaxed mb-8">
          Give your card a name so you can easily identify it later. This also creates a bot agent that will handle purchases on your behalf.
        </p>
        <div className="w-full max-w-md space-y-4 mb-8">
          <div className="space-y-2 text-left">
            <Label htmlFor="wizard-card-name" className="text-sm font-semibold">Card Name</Label>
            <Input
              id="wizard-card-name"
              placeholder="e.g. Shopping Agent, AWS Billing, Grocery Bot"
              value={cardName}
              onChange={(e) => setCardName(e.target.value)}
              className="rounded-xl text-base py-3"
              data-testid="input-wizard-card-name"
              onKeyDown={(e) => { if (e.key === "Enter" && cardName.trim()) setStep(1); }}
              autoFocus
            />
          </div>
        </div>
        <Button
          onClick={() => setStep(1)}
          disabled={!cardName.trim()}
          className="rounded-xl bg-primary hover:bg-primary/90 gap-2 px-8 py-3 text-base"
          data-testid="button-wizard-name-continue"
        >
          Continue
          <ArrowRight className="w-5 h-5" />
        </Button>
      </div>
    );

    allSteps.push(
      <div key="use-case" className="flex flex-col items-center text-center px-4 py-2" data-testid="wizard-step-use-case">
        <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-purple-100 to-indigo-100 flex items-center justify-center mb-6">
          <Tag className="w-10 h-10 text-purple-600" />
        </div>
        <h2 className="text-2xl font-bold text-neutral-900 mb-3">What will you use this card for?</h2>
        <p className="text-neutral-500 max-w-md leading-relaxed mb-6">
          This helps us tailor your experience. You can always change this later.
        </p>
        <div className="w-full max-w-md space-y-2 mb-6">
          {USE_CASE_OPTIONS.map((option) => (
            <button
              key={option.value}
              onClick={() => setUseCase(option.value)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border-2 transition-all text-left ${
                useCase === option.value
                  ? "border-primary bg-primary/5 shadow-sm"
                  : "border-neutral-100 hover:border-neutral-200 hover:bg-neutral-50"
              }`}
              data-testid={`button-usecase-${option.value}`}
            >
              <span className="text-xl flex-shrink-0">{option.icon}</span>
              <span className={`text-sm font-medium ${useCase === option.value ? "text-primary" : "text-neutral-700"}`}>
                {option.label}
              </span>
              {useCase === option.value && (
                <CheckCircle2 className="w-5 h-5 text-primary ml-auto flex-shrink-0" />
              )}
            </button>
          ))}

          {useCase === "other" && (
            <div className="pt-2">
              <Input
                placeholder="Tell us what you'll use it for..."
                value={otherUseCase}
                onChange={(e) => setOtherUseCase(e.target.value)}
                className="rounded-xl"
                data-testid="input-usecase-other"
                autoFocus
              />
            </div>
          )}
        </div>

        <div className="flex gap-3">
          <Button
            variant="outline"
            onClick={() => setStep(0)}
            className="rounded-xl gap-2 px-6 py-3"
            data-testid="button-wizard-usecase-back"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </Button>
          <Button
            onClick={handleCreateAndInitialize}
            disabled={!useCase || (useCase === "other" && !otherUseCase.trim()) || createLoading}
            className="rounded-xl bg-primary hover:bg-primary/90 gap-2 px-8 py-3 text-base"
            data-testid="button-wizard-usecase-continue"
          >
            {createLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <ArrowRight className="w-5 h-5" />}
            {createLoading ? "Setting up..." : "Continue"}
          </Button>
        </div>
      </div>
    );
  }

  allSteps.push(
    <div key="welcome" className="flex flex-col items-center text-center px-4 py-2" data-testid="wizard-step-welcome">
      <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-primary/20 to-purple-100 flex items-center justify-center mb-6">
        <Shield className="w-10 h-10 text-primary" />
      </div>
      <h2 className="text-2xl font-bold text-neutral-900 mb-3">Split-Knowledge Card Setup</h2>
      <p className="text-neutral-500 max-w-md leading-relaxed mb-6">
        {isNewMode
          ? `Great — "${cardName.trim()}" is ready. Now let's secure your card with split-knowledge protection. Here's what will happen:`
          : "We're about to set up a self-hosted card using our split-knowledge system. Here's what will happen:"}
      </p>
      <div className="grid gap-4 w-full max-w-md text-left mb-8">
        {[
          { num: "1", title: "Enter 3 secret digits", desc: "These digits are never stored — you type them on a card visual" },
          { num: "2", title: "Set spending permissions", desc: "Choose allowance limits and approval rules for your card" },
          { num: "3", title: "Download payment profiles", desc: "A file with 6 card profiles — 5 are fake, 1 is yours" },
          { num: "4", title: "Card goes live", desc: "Your bot can now make purchases with obfuscation protection" },
        ].map((item) => (
          <div key={item.num} className="flex items-start gap-3 bg-neutral-50 rounded-xl p-3.5 border border-neutral-100">
            <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
              <span className="text-xs font-bold text-primary">{item.num}</span>
            </div>
            <div>
              <p className="text-sm font-semibold text-neutral-800">{item.title}</p>
              <p className="text-xs text-neutral-500 mt-0.5">{item.desc}</p>
            </div>
          </div>
        ))}
      </div>
      {isNewMode ? (
        <Button
          onClick={() => setStep(stepOffset + 1)}
          disabled={!initData}
          className="rounded-xl bg-primary hover:bg-primary/90 gap-2 px-8 py-3 text-base"
          data-testid="button-wizard-start"
        >
          <Sparkles className="w-5 h-5" />
          Let's Go
        </Button>
      ) : (
        <Button
          onClick={handleInitialize}
          disabled={initLoading}
          className="rounded-xl bg-primary hover:bg-primary/90 gap-2 px-8 py-3 text-base"
          data-testid="button-wizard-start"
        >
          {initLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Sparkles className="w-5 h-5" />}
          {initLoading ? "Generating..." : "Let's Go"}
        </Button>
      )}
    </div>
  );

  allSteps.push(
    <div key="card-details" className="flex flex-col items-center px-4 py-2" data-testid="wizard-step-card">
      <h2 className="text-2xl font-bold text-neutral-900 mb-2 text-center">Enter Your Card Details</h2>
      <p className="text-neutral-500 max-w-md text-center leading-relaxed mb-6">
        Fill in the highlighted field below. Each field will light up in order as you go.
      </p>

      <InteractiveCard
        missingPositions={initData?.missing_digit_positions || []}
        missingDigits={missingDigits}
        onDigitChange={setMissingDigits}
        expiryMonth={expiryMonth}
        expiryYear={expiryYear}
        onExpiryMonthChange={setExpiryMonth}
        onExpiryYearChange={setExpiryYear}
        activeField={activeField}
      />

      <div className="w-full max-w-md mt-6">
        <div className="space-y-2">
          <label className="text-sm font-medium text-neutral-700">Billing ZIP Code</label>
          <Input
            ref={zipRef}
            value={ownerZip}
            onChange={(e) => setOwnerZip(e.target.value)}
            placeholder="90210"
            maxLength={10}
            className={`rounded-xl transition-all duration-200 ${
              ownerZip.trim()
                ? "border-green-400 ring-1 ring-green-200"
                : activeField === "zip"
                  ? "border-amber-400 ring-2 ring-amber-300/50"
                  : "border-amber-200 ring-1 ring-amber-100"
            }`}
            data-testid="input-wizard-zip"
          />
        </div>
      </div>

      <div className="flex gap-3 mt-8">
        <Button
          variant="outline"
          onClick={() => setStep(stepOffset)}
          className="rounded-xl gap-2 px-6 py-3"
          data-testid="button-wizard-back-to-welcome"
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </Button>
        <Button
          onClick={() => setStep(stepOffset + 2)}
          disabled={!cardDetailsComplete}
          className="rounded-xl bg-primary hover:bg-primary/90 gap-2 px-8 py-3 text-base"
          data-testid="button-wizard-continue-to-permissions"
        >
          Continue
          <ArrowRight className="w-5 h-5" />
        </Button>
      </div>
    </div>
  );

  allSteps.push(
    <div key="permissions" className="flex flex-col items-center px-4 py-2" data-testid="wizard-step-permissions">
      <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-100 to-indigo-100 flex items-center justify-center mb-6">
        <Shield className="w-8 h-8 text-purple-600" />
      </div>
      <h2 className="text-2xl font-bold text-neutral-900 mb-2 text-center">Set Card Permissions</h2>
      <p className="text-neutral-500 max-w-md text-center leading-relaxed mb-6">
        Configure spending limits and approval rules for this card. You can change these later in card settings.
      </p>

      <div className="w-full max-w-md space-y-4">
        <div className="space-y-2">
          <Label>Allowance Duration</Label>
          <Select value={permAllowanceDuration} onValueChange={setPermAllowanceDuration}>
            <SelectTrigger className="rounded-xl" data-testid="select-wizard-allowance-duration">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="day">Daily</SelectItem>
              <SelectItem value="week">Weekly</SelectItem>
              <SelectItem value="month">Monthly</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="wizard-allowance-value">Allowance Value ($)</Label>
          <Input
            id="wizard-allowance-value"
            type="number"
            min={0}
            value={permAllowanceValue}
            onChange={(e) => setPermAllowanceValue(e.target.value)}
            className="rounded-xl"
            data-testid="input-wizard-allowance-value"
          />
          <p className="text-xs text-neutral-400">Maximum spend per {permAllowanceDuration}</p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="wizard-exempt-limit">Confirmation Exempt Limit ($)</Label>
          <Input
            id="wizard-exempt-limit"
            type="number"
            min={0}
            value={permExemptLimit}
            onChange={(e) => setPermExemptLimit(e.target.value)}
            className="rounded-xl"
            data-testid="input-wizard-exempt-limit"
          />
          <p className="text-xs text-neutral-400">Purchases under this amount skip human approval</p>
        </div>

        <div className="space-y-2">
          <Label>Human Permission Required</Label>
          <Select value={permHumanPermission} onValueChange={setPermHumanPermission}>
            <SelectTrigger className="rounded-xl" data-testid="select-wizard-human-permission">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Transactions</SelectItem>
              <SelectItem value="above_exempt">Above Exempt Limit</SelectItem>
              <SelectItem value="none">None</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex gap-3 mt-8">
        <Button
          variant="outline"
          onClick={() => setStep(stepOffset + 1)}
          className="rounded-xl gap-2 px-6 py-3"
          data-testid="button-wizard-back-to-card"
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </Button>
        <Button
          onClick={handleActivate}
          disabled={submitLoading}
          className="rounded-xl bg-primary hover:bg-primary/90 gap-2 px-8 py-3 text-base"
          data-testid="button-wizard-activate"
        >
          {submitLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <CheckCircle2 className="w-5 h-5" />}
          {submitLoading ? "Activating..." : "Activate Card"}
        </Button>
      </div>
    </div>
  );

  allSteps.push(
    <div key="download" className="flex flex-col items-center text-center px-4 py-2" data-testid="wizard-step-download">
      <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-100 to-indigo-100 flex items-center justify-center mb-6">
        <Download className="w-8 h-8 text-blue-600" />
      </div>
      <h2 className="text-2xl font-bold text-neutral-900 mb-3">Download Payment Profiles</h2>
      <p className="text-neutral-500 max-w-md leading-relaxed mb-6">
        Your card is now active. Download your payment profiles file — it contains 6 card profiles 
        (5 fake, 1 real) with your permissions baked in.
      </p>

      <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl border border-blue-100 p-6 w-full max-w-md mb-6">
        <div className="flex items-center justify-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-white shadow-sm flex items-center justify-center">
            <CreditCard className="w-5 h-5 text-blue-600" />
          </div>
          <div className="text-left">
            <p className="text-sm font-bold text-neutral-800">{activationResult?.payment_profiles_filename}</p>
            <p className="text-xs text-neutral-500">6 profiles, 1 real</p>
          </div>
        </div>
        <Button
          onClick={handleDownload}
          className={`w-full rounded-xl gap-2 py-3 text-base transition-all ${
            downloaded
              ? "bg-green-500 hover:bg-green-600"
              : "bg-blue-600 hover:bg-blue-700"
          }`}
          data-testid="button-wizard-download"
        >
          {downloaded ? (
            <>
              <CheckCircle2 className="w-5 h-5" />
              Downloaded
            </>
          ) : (
            <>
              <Download className="w-5 h-5" />
              Download {activationResult?.payment_profiles_filename}
            </>
          )}
        </Button>
      </div>

      <div className="bg-amber-50 rounded-xl border border-amber-100 p-4 w-full max-w-md mb-6 text-left">
        <p className="text-sm font-semibold text-amber-800 mb-1">Important</p>
        <p className="text-xs text-amber-700 leading-relaxed">
          Save this file somewhere safe and give it to your bot. Your real card is Profile #{initData?.real_profile_index}. 
          Fill in your real card details for that profile, but leave the 3 digits as "xxx". 
          CreditClaw never sees your full card number.
        </p>
      </div>

      <Button
        onClick={() => setStep(stepOffset + 4)}
        disabled={!downloaded}
        className="rounded-xl bg-primary hover:bg-primary/90 gap-2 px-8 py-3 text-base"
        data-testid="button-wizard-continue-to-success"
      >
        Continue
        <ArrowRight className="w-5 h-5" />
      </Button>
    </div>
  );

  allSteps.push(
    <div key="success" className="flex flex-col items-center text-center px-4 py-2" data-testid="wizard-step-success">
      <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center mb-6">
        <CheckCircle2 className="w-10 h-10 text-green-600" />
      </div>
      <h2 className="text-2xl font-bold text-neutral-900 mb-3">Card Activated!</h2>
      <p className="text-neutral-500 max-w-md leading-relaxed mb-3">
        Your self-hosted card is now live. Your bot can make purchases, and CreditClaw 
        will use obfuscation to mask your real transactions among fake profiles.
      </p>

      <div className="bg-green-50 rounded-xl border border-green-100 p-4 w-full max-w-sm mb-8 text-left">
        <div className="flex items-center gap-3 mb-2">
          <Shield className="w-5 h-5 text-green-600" />
          <span className="text-sm font-semibold text-green-800">What happens next</span>
        </div>
        <ul className="space-y-1.5 text-xs text-green-700">
          <li>Obfuscation will start warming up automatically</li>
          <li>Adjust spending limits anytime via the card's settings menu</li>
          <li>All real purchases will require your approval via email</li>
        </ul>
      </div>

      <Button
        onClick={() => {
          onComplete();
          onOpenChange(false);
        }}
        className="rounded-xl bg-primary hover:bg-primary/90 gap-2 px-8 py-3 text-base"
        data-testid="button-wizard-done"
      >
        Go to Dashboard
        <ArrowRight className="w-5 h-5" />
      </Button>
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto p-8 rounded-2xl">
        <VisuallyHidden>
          <DialogTitle>Card Setup Wizard</DialogTitle>
        </VisuallyHidden>
        <StepIndicator current={step} total={totalSteps} />
        {allSteps[step]}
      </DialogContent>
    </Dialog>
  );
}
