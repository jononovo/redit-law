"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { CheckCircle2, Loader2, ArrowRight, ArrowLeft, CreditCard, Shield, Download, Lock, Bot, Sparkles, ChevronDown, X } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { authFetch } from "@/lib/auth-fetch";
import { encryptCardDetails, buildEncryptedCardFile, downloadEncryptedFile } from "@/lib/rail5/encrypt";
import { detectCardBrand, brandToApiValue, BRAND_DISPLAY_NAMES, getMaxDigits, formatCardNumber, getCardPlaceholder, type CardBrand } from "@/lib/card-brand";

interface Rail5SetupWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onComplete: () => void;
}

interface BotOption {
  bot_id: string;
  bot_name: string;
}

const TOTAL_STEPS = 8;

function StepIndicator({ current, total }: { current: number; total: number }) {
  return (
    <div className="flex items-center justify-center gap-2 mb-8" data-testid="r5-step-indicator">
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
            <div className={`w-5 h-0.5 transition-colors duration-300 ${i < current ? "bg-green-500" : "bg-neutral-200"}`} />
          )}
        </div>
      ))}
    </div>
  );
}

function BrandLogo({ brand }: { brand: CardBrand }) {
  const size = "w-14 h-10";
  const base = `${size} flex items-center justify-center rounded-md transition-all duration-300`;

  switch (brand) {
    case "visa":
      return (
        <div className={`${base} bg-white`}>
          <span className="text-[#1A1F71] font-extrabold italic text-lg tracking-tight" style={{ fontFamily: "Arial, sans-serif" }}>VISA</span>
        </div>
      );
    case "mastercard":
      return (
        <div className={`${base} bg-transparent`}>
          <div className="relative w-10 h-7">
            <div className="absolute left-0 top-0 w-7 h-7 rounded-full bg-[#EB001B] opacity-90" />
            <div className="absolute right-0 top-0 w-7 h-7 rounded-full bg-[#F79E1B] opacity-90" />
          </div>
        </div>
      );
    case "amex":
      return (
        <div className={`${base} bg-[#006FCF]`}>
          <span className="text-white font-bold text-[10px] tracking-wider">AMEX</span>
        </div>
      );
    case "discover":
      return (
        <div className={`${base} bg-white`}>
          <span className="text-[#FF6000] font-bold text-xs tracking-wide">DISCOVER</span>
        </div>
      );
    case "jcb":
      return (
        <div className={`${base} bg-white`}>
          <span className="text-[#0B4EA2] font-bold text-sm">JCB</span>
        </div>
      );
    case "diners":
      return (
        <div className={`${base} bg-white`}>
          <span className="text-[#004A97] font-bold text-[9px] tracking-tight">DINERS</span>
        </div>
      );
    default:
      return (
        <div className={`${base} bg-white/10`}>
          <CreditCard className="w-6 h-6 text-white/50" />
        </div>
      );
  }
}

interface CardFieldErrors {
  number?: boolean;
  month?: boolean;
  year?: boolean;
  cvv?: boolean;
  name?: boolean;
}

function Rail5InteractiveCard({
  cardNumber,
  onCardNumberChange,
  expiryMonth,
  expiryYear,
  onExpiryMonthChange,
  onExpiryYearChange,
  cvv,
  onCvvChange,
  holderName,
  onHolderNameChange,
  detectedBrand,
  errors = {},
}: {
  cardNumber: string;
  onCardNumberChange: (val: string) => void;
  expiryMonth: string;
  expiryYear: string;
  onExpiryMonthChange: (val: string) => void;
  onExpiryYearChange: (val: string) => void;
  cvv: string;
  onCvvChange: (val: string) => void;
  holderName: string;
  onHolderNameChange: (val: string) => void;
  detectedBrand: CardBrand;
  errors?: CardFieldErrors;
}) {
  const numberRef = useRef<HTMLInputElement>(null);
  const cvvRef = useRef<HTMLInputElement>(null);
  const holderRef = useRef<HTMLInputElement>(null);
  const monthRef = useRef<HTMLSelectElement>(null);
  const yearRef = useRef<HTMLSelectElement>(null);

  useEffect(() => {
    numberRef.current?.focus();
  }, []);

  const cleanNumber = cardNumber.replace(/\s/g, "");
  const formatted = formatCardNumber(cleanNumber, detectedBrand);

  const MONTHS = Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, "0"));
  const currentYear = new Date().getFullYear();
  const YEARS = Array.from({ length: 12 }, (_, i) => String(currentYear + i));

  const expectedDigits = getMaxDigits(detectedBrand);
  const minCvv = detectedBrand === "amex" ? 4 : 3;
  const monthFilled = !!expiryMonth;
  const yearFilled = !!expiryYear;
  const cvvFilled = cvv.length >= minCvv;
  const nameFilled = !!holderName.trim();
  const numberFilled = cleanNumber.length === expectedDigits;

  const numberBorder = errors.number
    ? "border-red-400 ring-2 ring-red-400/40"
    : numberFilled ? "border-green-400" : "border-white/20";
  const monthBorder = errors.month
    ? "border-red-400 ring-1 ring-red-400/40"
    : monthFilled ? "border-green-400" : "border-white/20";
  const yearBorder = errors.year
    ? "border-red-400 ring-1 ring-red-400/40"
    : yearFilled ? "border-green-400" : "border-white/20";
  const cvvBorder = errors.cvv
    ? "border-red-400 ring-2 ring-red-400/40"
    : cvvFilled ? "border-green-400" : "border-white/20";
  const nameBorder = errors.name
    ? "border-red-400 ring-2 ring-red-400/40"
    : nameFilled ? "border-green-400" : "border-white/20";

  return (
    <div className="relative mx-auto w-full" style={{ maxWidth: 520 }}>
      <div
        className="relative w-full rounded-2xl overflow-hidden shadow-2xl"
        style={{
          aspectRatio: "1.586",
          background: "linear-gradient(135deg, #1a1a2e 0%, #16213e 40%, #0f3460 100%)",
        }}
        data-testid="r5-interactive-card"
      >
        <div
          className="absolute inset-0 opacity-10 pointer-events-none"
          style={{
            backgroundImage: "radial-gradient(circle at 20% 50%, rgba(255,255,255,0.3) 0%, transparent 50%), radial-gradient(circle at 80% 20%, rgba(255,255,255,0.2) 0%, transparent 40%)",
          }}
        />

        <div className="relative h-full flex flex-col p-6">
          <div className="flex items-start justify-end">
            <BrandLogo brand={detectedBrand} />
          </div>

          <div className="flex-1 flex flex-col items-start justify-center">
            <div className="w-12 h-9 rounded-md bg-gradient-to-br from-amber-300 to-amber-500 flex items-center justify-center mb-3">
              <div className="w-8 h-5 rounded-sm border border-amber-600/30 bg-gradient-to-br from-amber-200 to-amber-400" />
            </div>
            <input
              ref={numberRef}
              type="text"
              inputMode="numeric"
              value={formatted}
              onChange={(e) => {
                const digits = e.target.value.replace(/\D/g, "");
                const brand = detectCardBrand(digits);
                onCardNumberChange(digits.slice(0, getMaxDigits(brand)));
              }}
              placeholder={getCardPlaceholder(detectedBrand)}
              className={`w-full bg-transparent border-b-2 ${numberBorder} focus:border-amber-300 text-white font-mono text-2xl tracking-[0.15em] placeholder:text-white/25 focus:outline-none pb-1 transition-all`}
              data-testid="input-r5-card-number"
              autoComplete="off"
            />

            <div className="flex items-end justify-end gap-3 mt-3 w-full">
              <div>
                <p className="text-[10px] text-white/40 uppercase tracking-wider mb-1">Expires</p>
                <div className="flex items-center gap-1">
                  <select
                    ref={monthRef}
                    value={expiryMonth}
                    onChange={(e) => onExpiryMonthChange(e.target.value)}
                    className={`bg-transparent border-b-2 text-white text-sm font-medium text-center focus:outline-none appearance-none cursor-pointer px-1 pb-0.5 transition-all ${monthBorder}`}
                    data-testid="select-r5-exp-month"
                  >
                    <option value="" className="bg-neutral-800 text-white">MM</option>
                    {MONTHS.map(m => <option key={m} value={m} className="bg-neutral-800 text-white">{m}</option>)}
                  </select>
                  <span className="text-white/40 text-sm">/</span>
                  <select
                    ref={yearRef}
                    value={expiryYear}
                    onChange={(e) => onExpiryYearChange(e.target.value)}
                    className={`bg-transparent border-b-2 text-white text-sm font-medium text-center focus:outline-none appearance-none cursor-pointer px-1 pb-0.5 transition-all ${yearBorder}`}
                    data-testid="select-r5-exp-year"
                  >
                    <option value="" className="bg-neutral-800 text-white">YYYY</option>
                    {YEARS.map(y => <option key={y} value={y} className="bg-neutral-800 text-white">{y}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <p className="text-[10px] text-white/40 uppercase tracking-wider mb-1">CVV</p>
                <input
                  ref={cvvRef}
                  type="password"
                  inputMode="numeric"
                  maxLength={4}
                  value={cvv}
                  onChange={(e) => onCvvChange(e.target.value.replace(/\D/g, "").slice(0, 4))}
                  placeholder="•••"
                  className={`w-14 bg-transparent border-b-2 ${cvvBorder} focus:border-amber-300 text-white text-sm font-mono text-center placeholder:text-white/25 focus:outline-none pb-0.5 transition-all`}
                  data-testid="input-r5-cvv"
                  autoComplete="off"
                />
              </div>
            </div>
          </div>

          <div className="mt-auto">
            <p className="text-[10px] text-white/40 uppercase tracking-wider mb-1">Cardholder</p>
            <input
              ref={holderRef}
              type="text"
              value={holderName}
              onChange={(e) => onHolderNameChange(e.target.value)}
              placeholder="Full Name"
              className={`w-full bg-transparent border-b-2 ${nameBorder} focus:border-amber-300 text-white text-base font-medium placeholder:text-white/25 focus:outline-none pb-0.5 transition-all uppercase tracking-wider`}
              data-testid="input-r5-holder"
              autoComplete="off"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

const FUN_CARD_NAMES = [
  "Titanium Claw",
  "Robo Platinum",
  "Agent Gold",
  "The Money Paw",
  "Claw Express",
  "Bot's Black Card",
  "Operation Checkout",
  "Stealth Card Alpha",
];

function randomCardName() {
  return FUN_CARD_NAMES[Math.floor(Math.random() * FUN_CARD_NAMES.length)];
}

export function Rail5SetupWizard({ open, onOpenChange, onComplete }: Rail5SetupWizardProps) {
  const { toast } = useToast();
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);

  const [cardName, setCardName] = useState(randomCardName);
  const [cardId, setCardId] = useState("");

  const [cardNumber, setCardNumber] = useState("");
  const [cardCvv, setCardCvv] = useState("");
  const [expMonth, setExpMonth] = useState("");
  const [expYear, setExpYear] = useState("");
  const [holderName, setHolderName] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [zip, setZip] = useState("");
  const [country, setCountry] = useState("US");
  const [showCountryPicker, setShowCountryPicker] = useState(false);

  const [encryptionDone, setEncryptionDone] = useState(false);
  const [downloadDone, setDownloadDone] = useState(false);
  const [keySent, setKeySent] = useState(false);

  const [spendingLimit, setSpendingLimit] = useState("50");
  const [dailyLimit, setDailyLimit] = useState("100");
  const [monthlyLimit, setMonthlyLimit] = useState("500");
  const [approveAll, setApproveAll] = useState(true);
  const [approvalThreshold, setApprovalThreshold] = useState("25");

  const [bots, setBots] = useState<BotOption[]>([]);
  const [selectedBotId, setSelectedBotId] = useState("");
  const [botsLoading, setBotsLoading] = useState(false);
  const [botsFetched, setBotsFetched] = useState(false);

  const [directDeliverySucceeded, setDirectDeliverySucceeded] = useState(false);
  const [deliveryAttempted, setDeliveryAttempted] = useState(false);
  const [copied, setCopied] = useState(false);

  const resetWizard = useCallback(() => {
    setStep(0);
    setLoading(false);
    setCardName(randomCardName());
    setCardId("");
    setCardNumber("");
    setCardCvv("");
    setExpMonth("");
    setExpYear("");
    setHolderName("");
    setAddress("");
    setCity("");
    setState("");
    setZip("");
    setCountry("US");
    setShowCountryPicker(false);
    setEncryptionDone(false);
    setDownloadDone(false);
    setKeySent(false);
    setSpendingLimit("50");
    setDailyLimit("100");
    setMonthlyLimit("500");
    setApproveAll(true);
    setApprovalThreshold("25");
    setBots([]);
    setSelectedBotId("");
    setBotsFetched(false);
    setDirectDeliverySucceeded(false);
    setDeliveryAttempted(false);
    setCopied(false);
    setCardErrors({});
    setShowExitConfirm(false);
  }, []);

  const [cardErrors, setCardErrors] = useState<CardFieldErrors>({});
  useEffect(() => {
    if (Object.keys(cardErrors).length === 0) return;
    const cleanNum = cardNumber.replace(/\s/g, "");
    const brand = detectCardBrand(cardNumber);
    const minCvvLen = brand === "amex" ? 4 : 3;
    const resolved: CardFieldErrors = {};
    if (cardErrors.number && cleanNum.length === getMaxDigits(brand)) resolved.number = false;
    if (cardErrors.month && expMonth) resolved.month = false;
    if (cardErrors.year && expYear) resolved.year = false;
    if (cardErrors.cvv && cardCvv.length >= minCvvLen) resolved.cvv = false;
    if (cardErrors.name && holderName.trim()) resolved.name = false;
    if (Object.keys(resolved).length > 0) {
      setCardErrors(prev => {
        const next = { ...prev };
        for (const k of Object.keys(resolved) as (keyof CardFieldErrors)[]) delete next[k];
        return next;
      });
    }
  }, [cardNumber, expMonth, expYear, cardCvv, holderName]);
  const [showExitConfirm, setShowExitConfirm] = useState(false);

  function handleClose(val: boolean) {
    if (!val && step !== 7) {
      setShowExitConfirm(true);
      return;
    }
    if (!val) resetWizard();
    onOpenChange(val);
  }

  function confirmExit() {
    setShowExitConfirm(false);
    resetWizard();
    onOpenChange(false);
  }

  const cardLast4 = cardNumber.replace(/\s/g, "").slice(-4);
  const detectedBrand = detectCardBrand(cardNumber);
  const cardBrand = brandToApiValue(detectedBrand);

  async function handleStep1Next() {
    if (!cardName.trim()) {
      toast({ title: "Missing info", description: "Enter a card name.", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      const res = await authFetch("/api/v1/rail5/initialize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ card_name: cardName.trim(), card_brand: cardBrand, card_last4: "0000" }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to initialize card");
      }
      const data = await res.json();
      setCardId(data.card_id);
      setStep(1);
    } catch (e: unknown) {
      toast({ title: "Error", description: e instanceof Error ? e.message : "Failed to initialize card.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  async function handleEncryptAndDownload() {
    const cleanNumber = cardNumber.replace(/\s/g, "");
    if (!cleanNumber || cleanNumber.length < 13 || !cardCvv.trim() || !expMonth || !expYear || !holderName.trim()) {
      toast({ title: "Missing info", description: "Fill in all card details.", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      const { keyHex, ivHex, tagHex, ciphertextBytes } = await encryptCardDetails({
        number: cardNumber.replace(/\s/g, ""),
        cvv: cardCvv,
        exp_month: parseInt(expMonth),
        exp_year: parseInt(expYear),
        name: holderName,
        address: address,
        city: city,
        state: state,
        zip: zip,
        country: country,
      });
      setEncryptionDone(true);

      const res = await authFetch("/api/v1/rail5/submit-key", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          card_id: cardId,
          key_hex: keyHex,
          iv_hex: ivHex,
          tag_hex: tagHex,
          card_last4: cardNumber.replace(/\s/g, "").slice(-4),
          card_brand: cardBrand,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to submit key");
      }
      setKeySent(true);

      const md = buildEncryptedCardFile(ciphertextBytes);

      if (selectedBotId) {
        setDeliveryAttempted(true);
        try {
          const deliverRes = await authFetch("/api/v1/rail5/deliver-to-bot", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              card_id: cardId,
              bot_id: selectedBotId,
              encrypted_file_content: md,
            }),
          });
          if (deliverRes.ok) {
            const deliverData = await deliverRes.json();
            if (deliverData.delivered) {
              setDirectDeliverySucceeded(true);
            }
          }
        } catch {
        }
      }

      downloadEncryptedFile(md, `Card-${cardName.replace(/[^a-zA-Z0-9-]/g, "")}-${cardLast4}.md`);
      setDownloadDone(true);

      setCardNumber("");
      setCardCvv("");
      setExpMonth("");
      setExpYear("");
      setHolderName("");
      setAddress("");
      setCity("");
      setState("");
      setZip("");
      setCountry("US");
      setShowCountryPicker(false);

      setStep(7);
    } catch (e: unknown) {
      toast({ title: "Error", description: e instanceof Error ? e.message : "Encryption failed.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  function handleCardDetailsNext() {
    const cleanNumber = cardNumber.replace(/\s/g, "");
    const expectedDigits = getMaxDigits(detectedBrand);
    const minCvv = detectedBrand === "amex" ? 4 : 3;
    const errs: CardFieldErrors = {
      number: cleanNumber.length !== expectedDigits,
      month: !expMonth,
      year: !expYear,
      cvv: !cardCvv || cardCvv.length < minCvv,
      name: !holderName.trim(),
    };
    if (Object.values(errs).some(Boolean)) {
      setCardErrors(errs);
      return;
    }
    setCardErrors({});
    setStep(3);
  }

  function handleAddressNext() {
    if (!address.trim()) {
      toast({ title: "Missing address", description: "Enter a street address.", variant: "destructive" });
      return;
    }
    if (!city.trim()) {
      toast({ title: "Missing city", description: "Enter a city.", variant: "destructive" });
      return;
    }
    if (!state.trim()) {
      toast({ title: "Missing state", description: "Enter a state.", variant: "destructive" });
      return;
    }
    if (!zip.trim()) {
      toast({ title: "Missing ZIP", description: "Enter a ZIP code.", variant: "destructive" });
      return;
    }
    setStep(4);
  }

  async function handleLimitsNext() {
    const s = Math.round(parseFloat(spendingLimit || "0") * 100);
    const d = Math.round(parseFloat(dailyLimit || "0") * 100);
    const m = Math.round(parseFloat(monthlyLimit || "0") * 100);
    const a = approveAll ? 0 : Math.round(parseFloat(approvalThreshold || "0") * 100);

    if (s < 100 || d < 100 || m < 100) {
      toast({ title: "Invalid limits", description: "Limits must be at least $1.00.", variant: "destructive" });
      return;
    }

    setLoading(true);
    try {
      const res = await authFetch(`/api/v1/rail5/cards/${cardId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          spending_limit_cents: s,
          daily_limit_cents: d,
          monthly_limit_cents: m,
          human_approval_above_cents: a,
        }),
      });
      if (!res.ok) throw new Error("Failed to update limits");
      setStep(5);
    } catch {
      toast({ title: "Error", description: "Failed to save spending limits.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  async function fetchBots() {
    setBotsLoading(true);
    try {
      const res = await authFetch("/api/v1/bots/mine");
      if (res.ok) {
        const data = await res.json();
        const loadedBots = data.bots || [];
        setBots(loadedBots);
        setBotsFetched(true);
        if (loadedBots.length === 1 && !selectedBotId) {
          setSelectedBotId(loadedBots[0].bot_id);
        }
      } else {
        setBotsFetched(true);
      }
    } catch {
      setBotsFetched(true);
    } finally {
      setBotsLoading(false);
    }
  }

  useEffect(() => {
    if (step === 5 && !botsFetched && !botsLoading) {
      fetchBots();
    }
  }, [step, botsFetched, botsLoading]);

  async function handleBotLink() {
    if (!selectedBotId) {
      setStep(6);
      return;
    }
    setLoading(true);
    try {
      const res = await authFetch(`/api/v1/rail5/cards/${cardId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bot_id: selectedBotId }),
      });
      if (!res.ok) throw new Error("Failed to link bot");
      setStep(6);
    } catch {
      toast({ title: "Error", description: "Failed to link bot.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  function handleDone() {
    handleClose(false);
    onComplete();
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent
        className="sm:max-w-2xl max-h-[90vh] overflow-y-auto p-8 [&>button:last-child]:hidden"
        onInteractOutside={(e) => { if (step !== 7) { e.preventDefault(); setShowExitConfirm(true); } }}
        onEscapeKeyDown={(e) => { if (step !== 7) { e.preventDefault(); setShowExitConfirm(true); } }}
      >
        <VisuallyHidden>
          <DialogTitle>Rail 5 Card Setup</DialogTitle>
        </VisuallyHidden>

        <button
          type="button"
          onClick={() => step === 7 ? handleClose(false) : setShowExitConfirm(true)}
          className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
          data-testid="button-r5-close"
        >
          <X className="h-4 w-4" />
          <span className="sr-only">Close</span>
        </button>

        {showExitConfirm && (
          <div className="absolute inset-0 z-50 bg-white/95 rounded-lg flex items-center justify-center p-8">
            <div className="text-center space-y-4 max-w-sm">
              <div className="w-12 h-12 rounded-2xl bg-red-50 flex items-center justify-center mx-auto">
                <X className="w-6 h-6 text-red-500" />
              </div>
              <h3 className="text-lg font-bold text-neutral-900">Exit Card Setup?</h3>
              <p className="text-sm text-neutral-500">Your progress will be lost. Are you sure you want to exit?</p>
              <div className="flex gap-3 pt-2">
                <Button
                  variant="outline"
                  onClick={() => setShowExitConfirm(false)}
                  className="flex-1"
                  data-testid="button-r5-continue-setup"
                >
                  Continue Setup
                </Button>
                <Button
                  onClick={confirmExit}
                  className="flex-1 bg-red-500 hover:bg-red-600 text-white"
                  data-testid="button-r5-confirm-exit"
                >
                  Exit
                </Button>
              </div>
            </div>
          </div>
        )}

        <StepIndicator current={step} total={TOTAL_STEPS} />

        {step === 0 && (
          <div className="space-y-6" data-testid="r5-step-card-info">
            <div className="text-center">
              <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-3">
                <CreditCard className="w-6 h-6 text-primary" />
              </div>
              <h2 className="text-xl font-bold text-neutral-900">Name Your Card</h2>
              <p className="text-sm text-neutral-500 mt-1">Give this card a name so you can identify it later.</p>
            </div>

            <div className="space-y-4">
              <div>
                <Input
                  id="r5-card-name"
                  placeholder="e.g. Harry's Visa"
                  value={cardName}
                  onChange={(e) => setCardName(e.target.value.slice(0, 200))}
                  data-testid="input-r5-card-name"
                />
              </div>

            </div>

            <Button onClick={handleStep1Next} disabled={loading} className="w-full gap-2" data-testid="button-r5-step1-next">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
              Next
            </Button>
          </div>
        )}

        {step === 1 && (
          <div className="space-y-6" data-testid="r5-step-explanation">
            <div className="text-center">
              <div className="w-12 h-12 rounded-2xl bg-emerald-50 flex items-center justify-center mx-auto mb-3">
                <Shield className="w-6 h-6 text-emerald-600" />
              </div>
              <h2 className="text-xl font-bold text-neutral-900">How It Works</h2>
            </div>

            <div className="bg-emerald-50 rounded-xl p-5 space-y-3">
              <p className="text-sm text-neutral-700 leading-relaxed">
                <strong>CreditClaw will never see your card details.</strong> Everything is encrypted in your browser before it leaves this page.
              </p>
              <div className="space-y-2 text-sm text-neutral-600">
                <div className="flex items-start gap-2">
                  <Lock className="w-4 h-4 text-emerald-600 mt-0.5 flex-shrink-0" />
                  <span>Your card details are encrypted using AES-256-GCM right here in your browser.</span>
                </div>
                <div className="flex items-start gap-2">
                  <Download className="w-4 h-4 text-emerald-600 mt-0.5 flex-shrink-0" />
                  <span>The encrypted file is delivered to your bot or downloaded for you to place manually.</span>
                </div>
                <div className="flex items-start gap-2">
                  <Shield className="w-4 h-4 text-emerald-600 mt-0.5 flex-shrink-0" />
                  <span>CreditClaw only stores the decryption key — never the card itself.</span>
                </div>
                <div className="flex items-start gap-2">
                  <Bot className="w-4 h-4 text-emerald-600 mt-0.5 flex-shrink-0" />
                  <span>At checkout, a disposable sub-agent gets the key, decrypts, pays, and is deleted.</span>
                </div>
              </div>
            </div>

            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setStep(0)} className="flex-1 gap-2" data-testid="button-r5-step2-back">
                <ArrowLeft className="w-4 h-4" /> Back
              </Button>
              <Button onClick={() => setStep(2)} className="flex-1 gap-2" data-testid="button-r5-step2-next">
                Got It <ArrowRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-6" data-testid="r5-step-card-entry">
            <div className="text-center">
              <div className="w-12 h-12 rounded-2xl bg-blue-50 flex items-center justify-center mx-auto mb-3">
                <Lock className="w-6 h-6 text-blue-600" />
              </div>
              <h2 className="text-xl font-bold text-neutral-900">Enter Card Details</h2>
              <p className="text-xs text-neutral-400 mt-1">This data never leaves your browser. It's encrypted locally.</p>
            </div>

            <Rail5InteractiveCard
              cardNumber={cardNumber}
              onCardNumberChange={setCardNumber}
              expiryMonth={expMonth}
              expiryYear={expYear}
              onExpiryMonthChange={setExpMonth}
              onExpiryYearChange={setExpYear}
              cvv={cardCvv}
              onCvvChange={setCardCvv}
              holderName={holderName}
              onHolderNameChange={setHolderName}
              detectedBrand={detectedBrand}
              errors={cardErrors}
            />

            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setStep(1)} className="flex-1 gap-2" data-testid="button-r5-step3-back">
                <ArrowLeft className="w-4 h-4" /> Back
              </Button>
              <Button onClick={handleCardDetailsNext} className="flex-1 gap-2" data-testid="button-r5-step3-next">
                Next <ArrowRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-6" data-testid="r5-step-address">
            <div className="text-center">
              <div className="w-12 h-12 rounded-2xl bg-indigo-50 flex items-center justify-center mx-auto mb-3">
                <CreditCard className="w-6 h-6 text-indigo-600" />
              </div>
              <h2 className="text-xl font-bold text-neutral-900">Billing Address</h2>
              <p className="text-sm text-neutral-500 mt-1">Enter the billing address associated with this card.</p>
            </div>

            <div className="space-y-4">
              <div>
                <Label htmlFor="r5-address">Street Address</Label>
                <Input
                  id="r5-address"
                  placeholder="123 Main St"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  data-testid="input-r5-address"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <Label htmlFor="r5-city">City</Label>
                  <Input id="r5-city" placeholder="New York" value={city} onChange={(e) => setCity(e.target.value)} data-testid="input-r5-city" />
                </div>
                <div>
                  <Label htmlFor="r5-state">State</Label>
                  <Input id="r5-state" placeholder="NY" maxLength={2} value={state} onChange={(e) => setState(e.target.value.toUpperCase().slice(0, 2))} data-testid="input-r5-state" />
                </div>
                <div>
                  <Label htmlFor="r5-zip">ZIP</Label>
                  <Input id="r5-zip" placeholder="10001" value={zip} onChange={(e) => setZip(e.target.value.replace(/\D/g, "").slice(0, 10))} data-testid="input-r5-zip" />
                </div>
              </div>

              <div className="flex flex-col items-center">
                <button
                  type="button"
                  onClick={() => setShowCountryPicker(!showCountryPicker)}
                  className="flex items-center gap-1 text-xs text-neutral-400 hover:text-neutral-600 transition-colors mt-1"
                  data-testid="button-r5-country-toggle"
                >
                  Not United States?
                  <ChevronDown className={`w-3 h-3 transition-transform ${showCountryPicker ? "rotate-180" : ""}`} />
                </button>
                {showCountryPicker && (
                  <div className="mt-2 w-full">
                    <Label htmlFor="r5-country">Country</Label>
                    <select
                      id="r5-country"
                      value={country}
                      onChange={(e) => setCountry(e.target.value)}
                      className="w-full h-10 rounded-md border border-neutral-200 bg-white px-3 text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                      data-testid="select-r5-country"
                    >
                      <option value="US">United States</option>
                      <option value="CA">Canada</option>
                      <option value="GB">United Kingdom</option>
                      <option value="AU">Australia</option>
                      <option value="DE">Germany</option>
                      <option value="FR">France</option>
                      <option value="JP">Japan</option>
                      <option value="BR">Brazil</option>
                      <option value="IN">India</option>
                      <option value="MX">Mexico</option>
                      <option value="IT">Italy</option>
                      <option value="ES">Spain</option>
                      <option value="NL">Netherlands</option>
                      <option value="SE">Sweden</option>
                      <option value="CH">Switzerland</option>
                      <option value="SG">Singapore</option>
                      <option value="KR">South Korea</option>
                      <option value="NZ">New Zealand</option>
                      <option value="IE">Ireland</option>
                      <option value="NO">Norway</option>
                      <option value="DK">Denmark</option>
                      <option value="FI">Finland</option>
                      <option value="AT">Austria</option>
                      <option value="BE">Belgium</option>
                      <option value="PT">Portugal</option>
                      <option value="PL">Poland</option>
                      <option value="IL">Israel</option>
                      <option value="AE">United Arab Emirates</option>
                    </select>
                  </div>
                )}
              </div>
            </div>

            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setStep(2)} className="flex-1 gap-2" data-testid="button-r5-step4-back">
                <ArrowLeft className="w-4 h-4" /> Back
              </Button>
              <Button onClick={handleAddressNext} className="flex-1 gap-2" data-testid="button-r5-step4-next">
                Next <ArrowRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}

        {step === 4 && /* Spending Limits */ (
          <div className="space-y-6" data-testid="r5-step-limits">
            <div className="text-center">
              <div className="w-12 h-12 rounded-2xl bg-orange-50 flex items-center justify-center mx-auto mb-3">
                <Shield className="w-6 h-6 text-orange-600" />
              </div>
              <h2 className="text-xl font-bold text-neutral-900">Spending Limits</h2>
              <p className="text-sm text-neutral-500 mt-1">Set guardrails for how your bot can spend.</p>
            </div>

            <div className="space-y-4">
              <div>
                <Label htmlFor="r5-per-checkout">Per-Transaction Limit ($)</Label>
                <Input
                  id="r5-per-checkout"
                  type="number"
                  min="1"
                  step="0.01"
                  value={spendingLimit}
                  onChange={(e) => setSpendingLimit(e.target.value)}
                  data-testid="input-r5-spending-limit"
                />
                <p className="text-xs text-neutral-400 mt-1">Max amount per individual purchase.</p>
              </div>

              <div>
                <Label htmlFor="r5-daily">Daily Limit ($)</Label>
                <Input
                  id="r5-daily"
                  type="number"
                  min="1"
                  step="0.01"
                  value={dailyLimit}
                  onChange={(e) => setDailyLimit(e.target.value)}
                  data-testid="input-r5-daily-limit"
                />
              </div>

              <div>
                <Label htmlFor="r5-monthly">Monthly Limit ($)</Label>
                <Input
                  id="r5-monthly"
                  type="number"
                  min="1"
                  step="0.01"
                  value={monthlyLimit}
                  onChange={(e) => setMonthlyLimit(e.target.value)}
                  data-testid="input-r5-monthly-limit"
                />
              </div>

              <div className="flex items-center justify-between rounded-lg border border-neutral-200 px-4 py-3">
                <div>
                  <p className="text-sm font-medium text-neutral-900">Approve every transaction</p>
                  <p className="text-xs text-neutral-400">You'll be asked to authorize each purchase.</p>
                </div>
                <Switch
                  checked={approveAll}
                  onCheckedChange={setApproveAll}
                  data-testid="switch-r5-approve-all"
                />
              </div>

              {!approveAll && (
                <div>
                  <Label htmlFor="r5-approval">Human Approval Above ($)</Label>
                  <Input
                    id="r5-approval"
                    type="number"
                    min="0"
                    step="0.01"
                    value={approvalThreshold}
                    onChange={(e) => setApprovalThreshold(e.target.value)}
                    data-testid="input-r5-approval-threshold"
                  />
                  <p className="text-xs text-neutral-400 mt-1">Purchases above this amount require your approval.</p>
                </div>
              )}
            </div>

            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setStep(3)} className="flex-1 gap-2" data-testid="button-r5-step5-back">
                <ArrowLeft className="w-4 h-4" /> Back
              </Button>
              <Button onClick={handleLimitsNext} disabled={loading} className="flex-1 gap-2" data-testid="button-r5-step5-next">
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
                Next
              </Button>
            </div>
          </div>
        )}

        {step === 5 && (
          <div className="space-y-6" data-testid="r5-step-bot">
            <div className="text-center">
              <div className="w-12 h-12 rounded-2xl bg-blue-50 flex items-center justify-center mx-auto mb-3">
                <Bot className="w-6 h-6 text-blue-600" />
              </div>
              <h2 className="text-xl font-bold text-neutral-900">Link a Bot</h2>
              <p className="text-sm text-neutral-500 mt-1">Choose which bot can use this card for purchases.</p>
            </div>

            {botsLoading && (
              <div className="flex flex-col items-center justify-center py-4 gap-2">
                <Loader2 className="w-6 h-6 animate-spin text-neutral-400" />
                <p className="text-xs text-neutral-400">Loading your bots...</p>
              </div>
            )}

            {!botsLoading && botsFetched && bots.length === 0 && (
              <div className="text-center py-4 space-y-2">
                <p className="text-sm text-neutral-500">No bots found. You can link one later from the card settings.</p>
                <Button variant="ghost" size="sm" onClick={() => { setBotsFetched(false); }} data-testid="button-r5-retry-bots">
                  Retry
                </Button>
              </div>
            )}

            {!botsLoading && bots.length > 0 && (
              <div className="space-y-2">
                {bots.map((bot) => (
                  <button
                    key={bot.bot_id}
                    onClick={() => setSelectedBotId(bot.bot_id === selectedBotId ? "" : bot.bot_id)}
                    className={`w-full text-left p-3 rounded-xl border-2 transition-all ${
                      selectedBotId === bot.bot_id
                        ? "border-primary bg-primary/5"
                        : "border-neutral-100 hover:border-neutral-200"
                    }`}
                    data-testid={`button-r5-select-bot-${bot.bot_id}`}
                  >
                    <div className="flex items-center gap-3">
                      <Bot className={`w-5 h-5 ${selectedBotId === bot.bot_id ? "text-primary" : "text-neutral-500"}`} />
                      <div>
                        <p className="font-medium text-neutral-900 text-sm">{bot.bot_name}</p>
                        <p className="text-xs text-neutral-400">{bot.bot_id}</p>
                      </div>
                      {selectedBotId === bot.bot_id && (
                        <CheckCircle2 className="w-5 h-5 text-primary ml-auto" />
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}

            <div className="flex gap-3">
              <Button variant="outline" onClick={() => { setSelectedBotId(""); setStep(6); }} className="flex-1" data-testid="button-r5-skip-bot">
                Skip for Now
              </Button>
              <Button
                onClick={handleBotLink}
                disabled={loading || botsLoading || (!selectedBotId && bots.length > 0)}
                className="flex-1 gap-2"
                data-testid="button-r5-link-bot"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
                {selectedBotId ? "Link & Continue" : bots.length === 0 ? "Continue" : "Select a Bot"}
              </Button>
            </div>
          </div>
        )}

        {step === 6 && (
          <div className="space-y-6" data-testid="r5-step-encrypt">
            <div className="text-center">
              <div className="w-12 h-12 rounded-2xl bg-purple-50 flex items-center justify-center mx-auto mb-3">
                <Lock className="w-6 h-6 text-purple-600" />
              </div>
              <h2 className="text-xl font-bold text-neutral-900">
                {selectedBotId ? "Encrypt & Deliver" : "Encrypt & Download"}
              </h2>
              <p className="text-sm text-neutral-500 mt-1">
                {selectedBotId
                  ? "Your card will be encrypted and delivered directly to your bot."
                  : "Your card will be encrypted and downloaded as a file."}
              </p>
            </div>

            <div className="bg-neutral-50 rounded-xl p-5 space-y-3">
              <div className="flex items-center gap-3">
                <div className={`w-6 h-6 rounded-full flex items-center justify-center ${encryptionDone ? "bg-green-500" : "bg-neutral-200"}`}>
                  {encryptionDone ? <CheckCircle2 className="w-4 h-4 text-white" /> : <span className="text-xs text-neutral-500">1</span>}
                </div>
                <span className="text-sm text-neutral-700">Encrypt card details (AES-256-GCM)</span>
              </div>
              <div className="flex items-center gap-3">
                <div className={`w-6 h-6 rounded-full flex items-center justify-center ${keySent ? "bg-green-500" : "bg-neutral-200"}`}>
                  {keySent ? <CheckCircle2 className="w-4 h-4 text-white" /> : <span className="text-xs text-neutral-500">2</span>}
                </div>
                <span className="text-sm text-neutral-700">Send decryption key to CreditClaw</span>
              </div>
              {selectedBotId && (
                <div className="flex items-center gap-3">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center ${directDeliverySucceeded ? "bg-green-500" : deliveryAttempted && !directDeliverySucceeded ? "bg-amber-500" : "bg-neutral-200"}`}>
                    {directDeliverySucceeded ? <CheckCircle2 className="w-4 h-4 text-white" /> : deliveryAttempted ? <span className="text-xs text-white">!</span> : <span className="text-xs text-neutral-500">3</span>}
                  </div>
                  <span className="text-sm text-neutral-700">
                    {directDeliverySucceeded ? "Delivered to bot" : deliveryAttempted ? "Delivery failed — downloading backup" : "Deliver encrypted file to bot"}
                  </span>
                </div>
              )}
              <div className="flex items-center gap-3">
                <div className={`w-6 h-6 rounded-full flex items-center justify-center ${downloadDone ? "bg-green-500" : "bg-neutral-200"}`}>
                  {downloadDone ? <CheckCircle2 className="w-4 h-4 text-white" /> : <span className="text-xs text-neutral-500">{selectedBotId ? "4" : "3"}</span>}
                </div>
                <span className="text-sm text-neutral-700">{selectedBotId ? "Download backup copy" : "Download encrypted card file"}</span>
              </div>
            </div>

            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setStep(5)} disabled={loading} className="flex-1 gap-2" data-testid="button-r5-step7-back">
                <ArrowLeft className="w-4 h-4" /> Back
              </Button>
              <Button onClick={handleEncryptAndDownload} disabled={loading || downloadDone} className="flex-1 gap-2 bg-purple-600 hover:bg-purple-700" data-testid="button-r5-encrypt">
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />}
                {downloadDone ? "Done!" : "Encrypt Now"}
              </Button>
            </div>
          </div>
        )}

        {step === 7 && (
          <div className="space-y-6" data-testid="r5-step-success">
            <div className="text-center">
              <div className="w-16 h-16 rounded-2xl bg-green-50 flex items-center justify-center mx-auto mb-4">
                <Sparkles className="w-8 h-8 text-green-600" />
              </div>
              <h2 className="text-2xl font-bold text-neutral-900">Card Ready!</h2>
              <p className="text-sm text-neutral-500 mt-2">
                {directDeliverySucceeded
                  ? "Your encrypted card has been delivered to your bot and is ready for checkout."
                  : "Your encrypted card has been set up successfully."}
              </p>
            </div>

            <div className="bg-neutral-50 rounded-xl p-5 space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-neutral-500">Card</span>
                <span className="font-medium text-neutral-900">{cardName} (••••{cardLast4})</span>
              </div>
              <div className="flex justify-between">
                <span className="text-neutral-500">Per-Checkout Limit</span>
                <span className="font-medium text-neutral-900">${spendingLimit}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-neutral-500">Daily / Monthly</span>
                <span className="font-medium text-neutral-900">${dailyLimit} / ${monthlyLimit}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-neutral-500">Bot</span>
                <span className="font-medium text-neutral-900">
                  {selectedBotId
                    ? `${bots.find(b => b.bot_id === selectedBotId)?.bot_name || selectedBotId}${directDeliverySucceeded ? " — Card delivered" : ""}`
                    : "Not linked yet"}
                </span>
              </div>
            </div>

            {!directDeliverySucceeded && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                <p className="text-sm text-amber-800 font-medium">
                  Place the downloaded <code className="bg-amber-100 px-1 py-0.5 rounded text-xs">Card-{cardName.replace(/[^a-zA-Z0-9-]/g, "")}-{cardLast4}.md</code> file in your bot's OpenClaw workspace.
                </p>
              </div>
            )}

            <div className="relative">
              <div className="bg-neutral-900 rounded-xl p-4 text-xs font-mono text-neutral-300 whitespace-pre-wrap leading-relaxed">
                {directDeliverySucceeded
                  ? `Your encrypted card has been delivered and ready for checkout.\n\nCard ID: ${cardId}\nCard: ${cardName} (••••${cardLast4})\nPer-Checkout Limit: $${spendingLimit}\nDaily / Monthly: $${dailyLimit} / $${monthlyLimit}\n\nYour card_id is always available via GET /api/v1/bot/status.\nAt checkout, use POST /api/v1/bot/rail5/checkout\nRequest decryption key via GET /api/v1/bot/rail5/key\nFull guide: https://creditclaw.com/skill.md (Rail 5 section)`
                  : `Place the downloaded Card-${cardName.replace(/[^a-zA-Z0-9-]/g, "")}-${cardLast4}.md file in your bot's OpenClaw workspace.\n\nCard ID: ${cardId}\nCard: ${cardName} (••••${cardLast4})\nPer-Checkout Limit: $${spendingLimit}\nDaily / Monthly: $${dailyLimit} / $${monthlyLimit}\n\nYour card_id is always available via GET /api/v1/bot/status.\nAt checkout, use POST /api/v1/bot/rail5/checkout\nRequest decryption key via GET /api/v1/bot/rail5/key\nFull guide: https://creditclaw.com/skill.md (Rail 5 section)`}
              </div>
              <Button
                variant="outline"
                size="sm"
                className="absolute top-2 right-2 text-xs h-7 bg-neutral-800 border-neutral-700 text-neutral-300 hover:bg-neutral-700 hover:text-white"
                data-testid="button-r5-copy-message"
                onClick={() => {
                  const msg = directDeliverySucceeded
                    ? `Your encrypted card has been delivered and ready for checkout.\n\nCard ID: ${cardId}\nCard: ${cardName} (••••${cardLast4})\nPer-Checkout Limit: $${spendingLimit}\nDaily / Monthly: $${dailyLimit} / $${monthlyLimit}\n\nYour card_id is always available via GET /api/v1/bot/status.\nAt checkout, use POST /api/v1/bot/rail5/checkout\nRequest decryption key via GET /api/v1/bot/rail5/key\nFull guide: https://creditclaw.com/skill.md (Rail 5 section)`
                    : `Place the downloaded Card-${cardName.replace(/[^a-zA-Z0-9-]/g, "")}-${cardLast4}.md file in your bot's OpenClaw workspace.\n\nCard ID: ${cardId}\nCard: ${cardName} (••••${cardLast4})\nPer-Checkout Limit: $${spendingLimit}\nDaily / Monthly: $${dailyLimit} / $${monthlyLimit}\n\nYour card_id is always available via GET /api/v1/bot/status.\nAt checkout, use POST /api/v1/bot/rail5/checkout\nRequest decryption key via GET /api/v1/bot/rail5/key\nFull guide: https://creditclaw.com/skill.md (Rail 5 section)`;
                  navigator.clipboard.writeText(msg).then(() => {
                    setCopied(true);
                    setTimeout(() => setCopied(false), 2000);
                  });
                }}
              >
                {copied ? "Copied!" : "Copy"}
              </Button>
            </div>

            <Button onClick={handleDone} className="w-full gap-2 bg-green-600 hover:bg-green-700" data-testid="button-r5-done">
              <CheckCircle2 className="w-4 h-4" /> Done
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
