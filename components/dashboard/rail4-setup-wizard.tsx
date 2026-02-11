"use client";

import { useState, useRef, useEffect } from "react";
import { Shield, Download, CheckCircle2, Loader2, ArrowRight, ArrowLeft, CreditCard, Sparkles } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { authFetch } from "@/lib/auth-fetch";

interface SetupWizardProps {
  botId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onComplete: () => void;
}

interface InitData {
  decoy_filename: string;
  real_profile_index: number;
  missing_digit_positions: number[];
  decoy_file_content: string;
  instructions: string;
}

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
            <div className={`w-12 h-0.5 transition-colors duration-300 ${i < current ? "bg-green-500" : "bg-neutral-200"}`} />
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

export function Rail4SetupWizard({ botId, open, onOpenChange, onComplete }: SetupWizardProps) {
  const { toast } = useToast();
  const [step, setStep] = useState(0);
  const [initLoading, setInitLoading] = useState(false);
  const [initData, setInitData] = useState<InitData | null>(null);
  const [downloaded, setDownloaded] = useState(false);
  const [missingDigits, setMissingDigits] = useState("");
  const [expiryMonth, setExpiryMonth] = useState("");
  const [expiryYear, setExpiryYear] = useState("");
  const [ownerZip, setOwnerZip] = useState("");
  const [submitLoading, setSubmitLoading] = useState(false);
  const zipRef = useRef<HTMLInputElement>(null);

  const digitsArr = missingDigits.split("");
  while (digitsArr.length < 3) digitsArr.push("");
  const activeField = getActiveField(digitsArr, expiryMonth, expiryYear, ownerZip);

  useEffect(() => {
    if (activeField === "zip" && step === 2) {
      zipRef.current?.focus();
    }
  }, [activeField, step]);

  useEffect(() => {
    if (!open) {
      setStep(0);
      setInitData(null);
      setDownloaded(false);
      setMissingDigits("");
      setExpiryMonth("");
      setExpiryYear("");
      setOwnerZip("");
    }
  }, [open]);

  async function handleInitialize() {
    setInitLoading(true);
    try {
      const res = await authFetch("/api/v1/rail4/initialize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bot_id: botId }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || "Failed to initialize");
      }
      const data = await res.json();
      setInitData(data);
      setStep(1);
    } catch (err: any) {
      toast({ title: "Setup failed", description: err.message || "Please try again.", variant: "destructive" });
    } finally {
      setInitLoading(false);
    }
  }

  function handleDownload() {
    if (!initData?.decoy_file_content) return;
    const blob = new Blob([initData.decoy_file_content], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = initData.decoy_filename || "decoy_cards.json";
    a.click();
    URL.revokeObjectURL(url);
    setDownloaded(true);
  }

  async function handleActivate() {
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
          bot_id: botId,
          missing_digits: missingDigits,
          expiry_month: parseInt(expiryMonth),
          expiry_year: parseInt(expiryYear),
          owner_zip: ownerZip.trim() || "00000",
        }),
      });
      if (!res.ok) throw new Error("Failed to activate");
      setStep(3);
    } catch {
      toast({ title: "Activation failed", description: "Please check your details and try again.", variant: "destructive" });
    } finally {
      setSubmitLoading(false);
    }
  }

  const stepContent = [
    <div key="welcome" className="flex flex-col items-center text-center px-4 py-2" data-testid="wizard-step-welcome">
      <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-primary/20 to-purple-100 flex items-center justify-center mb-6">
        <Shield className="w-10 h-10 text-primary" />
      </div>
      <h2 className="text-2xl font-bold text-neutral-900 mb-3">Split-Knowledge Card Setup</h2>
      <p className="text-neutral-500 max-w-md leading-relaxed mb-6">
        We're about to set up a self-hosted card using our split-knowledge system. 
        Here's what will happen:
      </p>
      <div className="grid gap-4 w-full max-w-md text-left mb-8">
        {[
          { num: "1", title: "We generate a decoy file", desc: "A file with 6 card profiles — 5 are fake, 1 is yours" },
          { num: "2", title: "You download it", desc: "Only you know which profile is the real one" },
          { num: "3", title: "Enter 3 secret digits", desc: "These digits are never stored — you type them on a card visual" },
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
      <Button
        onClick={handleInitialize}
        disabled={initLoading}
        className="rounded-xl bg-primary hover:bg-primary/90 gap-2 px-8 py-3 text-base"
        data-testid="button-wizard-start"
      >
        {initLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Sparkles className="w-5 h-5" />}
        {initLoading ? "Generating..." : "Let's Go"}
      </Button>
    </div>,

    <div key="download" className="flex flex-col items-center text-center px-4 py-2" data-testid="wizard-step-download">
      <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-100 to-indigo-100 flex items-center justify-center mb-6">
        <Download className="w-8 h-8 text-blue-600" />
      </div>
      <h2 className="text-2xl font-bold text-neutral-900 mb-3">Download Your Decoy File</h2>
      <p className="text-neutral-500 max-w-md leading-relaxed mb-6">
        This file contains 6 card profiles. Five are decoys used for obfuscation. 
        Your real card is <span className="font-bold text-primary">Profile #{initData?.real_profile_index}</span>.
      </p>

      <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl border border-blue-100 p-6 w-full max-w-md mb-6">
        <div className="flex items-center justify-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-white shadow-sm flex items-center justify-center">
            <CreditCard className="w-5 h-5 text-blue-600" />
          </div>
          <div className="text-left">
            <p className="text-sm font-bold text-neutral-800">{initData?.decoy_filename}</p>
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
              Download {initData?.decoy_filename}
            </>
          )}
        </Button>
      </div>

      <div className="bg-amber-50 rounded-xl border border-amber-100 p-4 w-full max-w-md mb-6 text-left">
        <p className="text-sm font-semibold text-amber-800 mb-1">Important</p>
        <p className="text-xs text-amber-700 leading-relaxed">
          Save this file somewhere safe. Fill in your real card details for Profile #{initData?.real_profile_index}, 
          but leave 3 digits as "xxx" — you'll enter those in the next step. 
          CreditClaw never sees your full card number.
        </p>
      </div>

      <Button
        onClick={() => setStep(2)}
        disabled={!downloaded}
        className="rounded-xl bg-primary hover:bg-primary/90 gap-2 px-8 py-3 text-base"
        data-testid="button-wizard-continue-to-card"
      >
        Continue
        <ArrowRight className="w-5 h-5" />
      </Button>
    </div>,

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
          onClick={() => setStep(1)}
          className="rounded-xl gap-2 px-6 py-3"
          data-testid="button-wizard-back-to-download"
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </Button>
        <Button
          onClick={handleActivate}
          disabled={submitLoading || missingDigits.length < 3 || !expiryMonth || !expiryYear}
          className="rounded-xl bg-primary hover:bg-primary/90 gap-2 px-8 py-3 text-base"
          data-testid="button-wizard-activate"
        >
          {submitLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <CheckCircle2 className="w-5 h-5" />}
          {submitLoading ? "Activating..." : "Activate Card"}
        </Button>
      </div>
    </div>,

    <div key="success" className="flex flex-col items-center text-center px-4 py-2" data-testid="wizard-step-success">
      <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center mb-6">
        <CheckCircle2 className="w-10 h-10 text-green-600" />
      </div>
      <h2 className="text-2xl font-bold text-neutral-900 mb-3">Card Activated!</h2>
      <p className="text-neutral-500 max-w-md leading-relaxed mb-3">
        Your self-hosted card is now live. Your bot can make purchases, and CreditClaw 
        will use obfuscation to mask your real transactions among decoy profiles.
      </p>

      <div className="bg-green-50 rounded-xl border border-green-100 p-4 w-full max-w-sm mb-8 text-left">
        <div className="flex items-center gap-3 mb-2">
          <Shield className="w-5 h-5 text-green-600" />
          <span className="text-sm font-semibold text-green-800">What happens next</span>
        </div>
        <ul className="space-y-1.5 text-xs text-green-700">
          <li>Obfuscation will start warming up automatically</li>
          <li>Set spending limits in the Permissions panel</li>
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
    </div>,
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-2xl w-[95vw] max-h-[90vh] overflow-y-auto rounded-2xl p-8"
        data-testid="wizard-dialog"
      >
        <StepIndicator current={step} total={4} />
        {stepContent[step]}
      </DialogContent>
    </Dialog>
  );
}
