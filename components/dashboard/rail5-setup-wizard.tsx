"use client";

import { useState, useCallback } from "react";
import { CheckCircle2, Loader2, ArrowRight, ArrowLeft, CreditCard, Shield, Download, Lock, Bot, Sparkles } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { authFetch } from "@/lib/auth-fetch";

interface Rail5SetupWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onComplete: () => void;
}

interface BotOption {
  bot_id: string;
  bot_name: string;
}

const TOTAL_STEPS = 7;

function bufToHex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, "0")).join("");
}

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
            <div className={`w-8 h-0.5 transition-colors duration-300 ${i < current ? "bg-green-500" : "bg-neutral-200"}`} />
          )}
        </div>
      ))}
    </div>
  );
}

export function Rail5SetupWizard({ open, onOpenChange, onComplete }: Rail5SetupWizardProps) {
  const { toast } = useToast();
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);

  const [cardName, setCardName] = useState("");
  const [cardBrand, setCardBrand] = useState("visa");
  const [cardLast4, setCardLast4] = useState("");
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

  const [encryptionDone, setEncryptionDone] = useState(false);
  const [downloadDone, setDownloadDone] = useState(false);
  const [keySent, setKeySent] = useState(false);

  const [spendingLimit, setSpendingLimit] = useState("50");
  const [dailyLimit, setDailyLimit] = useState("100");
  const [monthlyLimit, setMonthlyLimit] = useState("500");
  const [approvalThreshold, setApprovalThreshold] = useState("25");

  const [bots, setBots] = useState<BotOption[]>([]);
  const [selectedBotId, setSelectedBotId] = useState("");
  const [botsLoading, setBotsLoading] = useState(false);

  const resetWizard = useCallback(() => {
    setStep(0);
    setLoading(false);
    setCardName("");
    setCardBrand("visa");
    setCardLast4("");
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
    setEncryptionDone(false);
    setDownloadDone(false);
    setKeySent(false);
    setSpendingLimit("50");
    setDailyLimit("100");
    setMonthlyLimit("500");
    setApprovalThreshold("25");
    setBots([]);
    setSelectedBotId("");
  }, []);

  function handleClose(val: boolean) {
    if (!val) resetWizard();
    onOpenChange(val);
  }

  async function handleStep1Next() {
    if (!cardName.trim() || !/^\d{4}$/.test(cardLast4)) {
      toast({ title: "Missing info", description: "Enter a card name and 4-digit last4.", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      const res = await authFetch("/api/v1/rail5/initialize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ card_name: cardName.trim(), card_brand: cardBrand, card_last4: cardLast4 }),
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
    if (!cardNumber.trim() || !cardCvv.trim() || !expMonth || !expYear || !holderName.trim()) {
      toast({ title: "Missing info", description: "Fill in all card details.", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      const cardJson = JSON.stringify({
        number: cardNumber.replace(/\s/g, ""),
        cvv: cardCvv,
        exp_month: parseInt(expMonth),
        exp_year: parseInt(expYear),
        name: holderName,
        address: address,
        city: city,
        state: state,
        zip: zip,
      });

      const key = await crypto.subtle.generateKey(
        { name: "AES-GCM", length: 256 },
        true,
        ["encrypt"]
      );
      const iv = crypto.getRandomValues(new Uint8Array(12));

      const ciphertext = await crypto.subtle.encrypt(
        { name: "AES-GCM", iv },
        key,
        new TextEncoder().encode(cardJson)
      );
      setEncryptionDone(true);

      const rawKey = await crypto.subtle.exportKey("raw", key);
      const ciphertextBytes = new Uint8Array(ciphertext);
      const tagBytes = ciphertextBytes.slice(-16);

      const keyHex = bufToHex(rawKey);
      const ivHex = bufToHex(iv);
      const tagHex = bufToHex(tagBytes);

      const res = await authFetch("/api/v1/rail5/submit-key", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          card_id: cardId,
          key_hex: keyHex,
          iv_hex: ivHex,
          tag_hex: tagHex,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to submit key");
      }
      setKeySent(true);

      const b64 = btoa(String.fromCharCode(...ciphertextBytes));
      const md = `# CreditClaw Encrypted Card\n\nThis file contains your encrypted card details for Rail 5 sub-agent checkout.\nDo not edit or share this file. Place it in your bot's OpenClaw workspace.\n\n\`\`\`\n${b64}\n\`\`\`\n`;

      const blob = new Blob([md], { type: "text/markdown" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Card-${cardName.replace(/[^a-zA-Z0-9-]/g, "")}-${cardLast4}.md`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
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

      setStep(4);
    } catch (e: unknown) {
      toast({ title: "Error", description: e instanceof Error ? e.message : "Encryption failed.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  async function handleLimitsNext() {
    const s = Math.round(parseFloat(spendingLimit || "0") * 100);
    const d = Math.round(parseFloat(dailyLimit || "0") * 100);
    const m = Math.round(parseFloat(monthlyLimit || "0") * 100);
    const a = Math.round(parseFloat(approvalThreshold || "0") * 100);

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
        setBots(data.bots || []);
      }
    } catch {
    } finally {
      setBotsLoading(false);
    }
  }

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

  const MONTHS = Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, "0"));
  const currentYear = new Date().getFullYear();
  const YEARS = Array.from({ length: 12 }, (_, i) => String(currentYear + i));

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <VisuallyHidden>
          <DialogTitle>Rail 5 Card Setup</DialogTitle>
        </VisuallyHidden>

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
                <Label htmlFor="r5-card-name">Card Name</Label>
                <Input
                  id="r5-card-name"
                  placeholder="e.g. Harry's Visa"
                  value={cardName}
                  onChange={(e) => setCardName(e.target.value.slice(0, 200))}
                  data-testid="input-r5-card-name"
                />
              </div>

              <div>
                <Label>Card Brand</Label>
                <Select value={cardBrand} onValueChange={setCardBrand}>
                  <SelectTrigger data-testid="select-r5-card-brand">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="visa">Visa</SelectItem>
                    <SelectItem value="mastercard">Mastercard</SelectItem>
                    <SelectItem value="amex">American Express</SelectItem>
                    <SelectItem value="discover">Discover</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="r5-last4">Last 4 Digits</Label>
                <Input
                  id="r5-last4"
                  placeholder="1234"
                  maxLength={4}
                  value={cardLast4}
                  onChange={(e) => setCardLast4(e.target.value.replace(/\D/g, "").slice(0, 4))}
                  data-testid="input-r5-last4"
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
                  <span>You'll download an encrypted file and place it in your bot's workspace.</span>
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

            <div className="space-y-4">
              <div>
                <Label htmlFor="r5-number">Card Number</Label>
                <Input
                  id="r5-number"
                  placeholder="4111 1111 1111 1111"
                  value={cardNumber}
                  onChange={(e) => setCardNumber(e.target.value.replace(/[^\d\s]/g, "").slice(0, 23))}
                  data-testid="input-r5-card-number"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <Label>Month</Label>
                  <Select value={expMonth} onValueChange={setExpMonth}>
                    <SelectTrigger data-testid="select-r5-exp-month">
                      <SelectValue placeholder="MM" />
                    </SelectTrigger>
                    <SelectContent>
                      {MONTHS.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Year</Label>
                  <Select value={expYear} onValueChange={setExpYear}>
                    <SelectTrigger data-testid="select-r5-exp-year">
                      <SelectValue placeholder="YYYY" />
                    </SelectTrigger>
                    <SelectContent>
                      {YEARS.map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="r5-cvv">CVV</Label>
                  <Input
                    id="r5-cvv"
                    type="password"
                    placeholder="123"
                    maxLength={4}
                    value={cardCvv}
                    onChange={(e) => setCardCvv(e.target.value.replace(/\D/g, "").slice(0, 4))}
                    data-testid="input-r5-cvv"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="r5-holder">Cardholder Name</Label>
                <Input
                  id="r5-holder"
                  placeholder="Harry Smith"
                  value={holderName}
                  onChange={(e) => setHolderName(e.target.value)}
                  data-testid="input-r5-holder"
                />
              </div>

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
            </div>

            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setStep(1)} className="flex-1 gap-2" data-testid="button-r5-step3-back">
                <ArrowLeft className="w-4 h-4" /> Back
              </Button>
              <Button onClick={() => setStep(3)} className="flex-1 gap-2" data-testid="button-r5-step3-next">
                Encrypt & Download <ArrowRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-6" data-testid="r5-step-encrypt">
            <div className="text-center">
              <div className="w-12 h-12 rounded-2xl bg-purple-50 flex items-center justify-center mx-auto mb-3">
                <Lock className="w-6 h-6 text-purple-600" />
              </div>
              <h2 className="text-xl font-bold text-neutral-900">Encrypt & Download</h2>
              <p className="text-sm text-neutral-500 mt-1">Your card will be encrypted and downloaded as a file.</p>
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
              <div className="flex items-center gap-3">
                <div className={`w-6 h-6 rounded-full flex items-center justify-center ${downloadDone ? "bg-green-500" : "bg-neutral-200"}`}>
                  {downloadDone ? <CheckCircle2 className="w-4 h-4 text-white" /> : <span className="text-xs text-neutral-500">3</span>}
                </div>
                <span className="text-sm text-neutral-700">Download encrypted card file</span>
              </div>
            </div>

            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setStep(2)} disabled={loading} className="flex-1 gap-2" data-testid="button-r5-step4-back">
                <ArrowLeft className="w-4 h-4" /> Back
              </Button>
              <Button onClick={handleEncryptAndDownload} disabled={loading || downloadDone} className="flex-1 gap-2 bg-purple-600 hover:bg-purple-700" data-testid="button-r5-encrypt">
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />}
                {downloadDone ? "Done!" : "Encrypt Now"}
              </Button>
            </div>
          </div>
        )}

        {step === 4 && (
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
                <Label htmlFor="r5-per-checkout">Per-Checkout Limit ($)</Label>
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
            </div>

            <Button onClick={handleLimitsNext} disabled={loading} className="w-full gap-2" data-testid="button-r5-step5-next">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
              Next
            </Button>
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

            {bots.length === 0 && !botsLoading && (
              <Button variant="outline" onClick={fetchBots} className="w-full" data-testid="button-r5-load-bots">
                Load My Bots
              </Button>
            )}

            {botsLoading && (
              <div className="flex justify-center py-4">
                <Loader2 className="w-6 h-6 animate-spin text-neutral-400" />
              </div>
            )}

            {bots.length > 0 && (
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
                      <Bot className="w-5 h-5 text-neutral-500" />
                      <div>
                        <p className="font-medium text-neutral-900 text-sm">{bot.bot_name}</p>
                        <p className="text-xs text-neutral-400">{bot.bot_id}</p>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}

            {bots.length === 0 && !botsLoading && (
              <p className="text-xs text-neutral-400 text-center">No bots? You can link one later from the card settings.</p>
            )}

            <div className="flex gap-3">
              <Button variant="outline" onClick={() => { setSelectedBotId(""); setStep(6); }} className="flex-1" data-testid="button-r5-skip-bot">
                Skip for Now
              </Button>
              <Button onClick={handleBotLink} disabled={loading} className="flex-1 gap-2" data-testid="button-r5-link-bot">
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
                {selectedBotId ? "Link & Continue" : "Continue"}
              </Button>
            </div>
          </div>
        )}

        {step === 6 && (
          <div className="space-y-6" data-testid="r5-step-success">
            <div className="text-center">
              <div className="w-16 h-16 rounded-2xl bg-green-50 flex items-center justify-center mx-auto mb-4">
                <Sparkles className="w-8 h-8 text-green-600" />
              </div>
              <h2 className="text-2xl font-bold text-neutral-900">Card Ready!</h2>
              <p className="text-sm text-neutral-500 mt-2">Your encrypted card has been set up successfully.</p>
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
                  {selectedBotId ? bots.find(b => b.bot_id === selectedBotId)?.bot_name || selectedBotId : "Not linked yet"}
                </span>
              </div>
            </div>

            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
              <p className="text-sm text-amber-800 font-medium">
                Place the downloaded <code className="bg-amber-100 px-1 py-0.5 rounded text-xs">Card-{cardName.replace(/[^a-zA-Z0-9-]/g, "")}-{cardLast4}.md</code> file in your bot's OpenClaw workspace.
              </p>
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
