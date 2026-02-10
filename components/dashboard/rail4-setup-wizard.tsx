"use client";

import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Download, CheckCircle, ChevronRight, ChevronLeft, ShieldCheck, AlertTriangle } from "lucide-react";

interface BotOption {
  bot_id: string;
  bot_name: string;
}

interface InitializeResponse {
  status: string;
  decoy_filename: string;
  real_profile_index: number;
  missing_digit_positions: number[];
  decoy_file_content: string;
  message: string;
}

interface Rail4SetupWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onComplete: () => void;
}

const STEP_TITLES = [
  "Select Bot",
  "Download Decoy File",
  "Confirm Setup",
  "Submit Card Data",
];

export function Rail4SetupWizard({ open, onOpenChange, onComplete }: Rail4SetupWizardProps) {
  const { toast } = useToast();
  const [step, setStep] = useState(0);
  const [bots, setBots] = useState<BotOption[]>([]);
  const [botsLoading, setBotsLoading] = useState(true);
  const [selectedBotId, setSelectedBotId] = useState("");
  const [initializing, setInitializing] = useState(false);
  const [initData, setInitData] = useState<InitializeResponse | null>(null);
  const [downloaded, setDownloaded] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [missingDigits, setMissingDigits] = useState("");
  const [expiryMonth, setExpiryMonth] = useState("");
  const [expiryYear, setExpiryYear] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [ownerZip, setOwnerZip] = useState("");
  const [complete, setComplete] = useState(false);

  useEffect(() => {
    if (open) {
      setStep(0);
      setSelectedBotId("");
      setInitData(null);
      setDownloaded(false);
      setConfirmed(false);
      setMissingDigits("");
      setExpiryMonth("");
      setExpiryYear("");
      setOwnerName("");
      setOwnerZip("");
      setComplete(false);
      fetchBots();
    }
  }, [open]);

  async function fetchBots() {
    setBotsLoading(true);
    try {
      const res = await fetch("/api/v1/bots/mine");
      if (res.ok) {
        const data = await res.json();
        const allBots: BotOption[] = (data.bots || []).map((b: any) => ({
          bot_id: b.bot_id,
          bot_name: b.bot_name,
        }));

        const statusChecks = await Promise.all(
          allBots.map(async (bot) => {
            try {
              const statusRes = await fetch(`/api/v1/rail4/status?bot_id=${bot.bot_id}`);
              if (statusRes.ok) {
                const statusData = await statusRes.json();
                return { ...bot, rail4Status: statusData.status };
              }
            } catch {}
            return { ...bot, rail4Status: "not_configured" };
          })
        );

        setBots(statusChecks.filter((b) => b.rail4Status !== "active"));
      }
    } catch {} finally {
      setBotsLoading(false);
    }
  }

  async function handleInitialize() {
    if (!selectedBotId) return;
    setInitializing(true);
    try {
      const res = await fetch("/api/v1/rail4/initialize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bot_id: selectedBotId }),
      });
      if (!res.ok) {
        const err = await res.json();
        toast({ title: "Initialization failed", description: err.message || "Please try again.", variant: "destructive" });
        return;
      }
      const data: InitializeResponse = await res.json();
      setInitData(data);
      setStep(1);
    } catch {
      toast({ title: "Network error", description: "Could not connect to server.", variant: "destructive" });
    } finally {
      setInitializing(false);
    }
  }

  function handleDownload() {
    if (!initData) return;
    const blob = new Blob([initData.decoy_file_content], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = initData.decoy_filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setDownloaded(true);
  }

  async function handleSubmit() {
    if (!selectedBotId) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/v1/rail4/submit-owner-data", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bot_id: selectedBotId,
          missing_digits: missingDigits,
          expiry_month: parseInt(expiryMonth),
          expiry_year: parseInt(expiryYear),
          owner_name: ownerName,
          owner_zip: ownerZip,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        toast({ title: "Submission failed", description: err.message || "Please check your inputs.", variant: "destructive" });
        return;
      }
      setComplete(true);
      toast({ title: "Card configured!", description: "Your self-hosted card is now active." });
    } catch {
      toast({ title: "Network error", description: "Could not connect to server.", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  }

  function handleClose() {
    if (complete) {
      onComplete();
    }
    onOpenChange(false);
  }

  const isSubmitValid =
    missingDigits.length === 3 &&
    /^\d{3}$/.test(missingDigits) &&
    expiryMonth &&
    expiryYear &&
    ownerName.trim().length > 0 &&
    ownerZip.trim().length > 0;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-emerald-600" />
            Set Up Self-Hosted Card
          </DialogTitle>
          <DialogDescription>
            {complete ? "Setup complete!" : `Step ${step + 1} of 4 — ${STEP_TITLES[step]}`}
          </DialogDescription>
        </DialogHeader>

        <div className="flex gap-1 mb-2">
          {STEP_TITLES.map((_, i) => (
            <div
              key={i}
              className={`h-1 flex-1 rounded-full transition-all ${
                i <= step ? "bg-emerald-500" : "bg-neutral-200"
              }`}
            />
          ))}
        </div>

        {complete ? (
          <div className="flex flex-col items-center py-8 gap-4">
            <div className="w-16 h-16 rounded-full bg-emerald-50 flex items-center justify-center">
              <CheckCircle className="w-8 h-8 text-emerald-600" />
            </div>
            <div className="text-center">
              <h3 className="font-bold text-lg text-neutral-900">Card Active</h3>
              <p className="text-sm text-neutral-500 mt-1 max-w-sm">
                Your self-hosted card is configured and ready. Make sure the decoy file is saved to your bot's filesystem.
              </p>
            </div>
            <Button onClick={handleClose} className="mt-2" data-testid="button-wizard-done">
              Done
            </Button>
          </div>
        ) : step === 0 ? (
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Which bot should use this card?</Label>
              {botsLoading ? (
                <div className="flex items-center justify-center py-6">
                  <Loader2 className="w-5 h-5 animate-spin text-neutral-400" />
                </div>
              ) : bots.length === 0 ? (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                    <span>No eligible bots found. Either all your bots already have active self-hosted cards, or you haven&apos;t connected any bots yet. Add new bots in the Overview page <a href="/app" className="underline font-semibold hover:text-amber-900">here</a>.</span>
                  </div>
                </div>
              ) : (
                <Select value={selectedBotId} onValueChange={setSelectedBotId}>
                  <SelectTrigger data-testid="select-bot">
                    <SelectValue placeholder="Select a bot..." />
                  </SelectTrigger>
                  <SelectContent>
                    {bots.map((bot) => (
                      <SelectItem key={bot.bot_id} value={bot.bot_id}>
                        {bot.bot_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
            <div className="flex justify-end">
              <Button
                onClick={handleInitialize}
                disabled={!selectedBotId || initializing}
                data-testid="button-wizard-next-0"
              >
                {initializing ? (
                  <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Initializing...</>
                ) : (
                  <>Initialize <ChevronRight className="w-4 h-4 ml-1" /></>
                )}
              </Button>
            </div>
          </div>
        ) : step === 1 ? (
          <div className="space-y-4 py-2">
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 space-y-3">
              <p className="text-sm font-medium text-emerald-900">Your decoy file is ready!</p>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <span className="text-emerald-600 text-xs">Filename</span>
                  <p className="font-mono font-bold text-emerald-900" data-testid="text-decoy-filename">{initData?.decoy_filename}</p>
                </div>
                <div>
                  <span className="text-emerald-600 text-xs">Your Profile</span>
                  <p className="font-bold text-emerald-900" data-testid="text-profile-index">#{initData?.real_profile_index}</p>
                </div>
                <div className="col-span-2">
                  <span className="text-emerald-600 text-xs">Missing Digit Positions</span>
                  <p className="font-mono font-bold text-emerald-900" data-testid="text-missing-positions">
                    {initData?.missing_digit_positions?.join(", ")}
                  </p>
                </div>
              </div>
            </div>

            <Button
              onClick={handleDownload}
              variant={downloaded ? "outline" : "default"}
              className="w-full gap-2"
              data-testid="button-download-decoy"
            >
              <Download className="w-4 h-4" />
              {downloaded ? "Download Again" : "Download Decoy File"}
            </Button>

            {downloaded && (
              <p className="text-xs text-neutral-500 text-center">File downloaded. You'll fill in your card details in the next step.</p>
            )}

            <div className="flex justify-between">
              <Button variant="ghost" onClick={() => setStep(0)} data-testid="button-wizard-back-1">
                <ChevronLeft className="w-4 h-4 mr-1" /> Back
              </Button>
              <Button onClick={() => setStep(2)} disabled={!downloaded} data-testid="button-wizard-next-1">
                Next <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
          </div>
        ) : step === 2 ? (
          <div className="space-y-4 py-2">
            <div className="bg-neutral-50 border border-neutral-200 rounded-xl p-4 space-y-3 text-sm text-neutral-700">
              <p className="font-medium text-neutral-900">Before continuing, make sure you've done the following:</p>
              <ol className="list-decimal list-inside space-y-2 ml-1">
                <li>
                  Open <span className="font-mono font-bold text-emerald-700">{initData?.decoy_filename}</span> in a text editor
                </li>
                <li>
                  Find <span className="font-bold">Profile #{initData?.real_profile_index}</span> — this is your real profile
                </li>
                <li>
                  Fill in your real card number, but leave positions{" "}
                  <span className="font-mono font-bold">{initData?.missing_digit_positions?.join(", ")}</span>{" "}
                  as <span className="font-mono font-bold text-red-600">XXX</span>
                </li>
                <li>
                  Fill in your real CVV, name, and address
                </li>
                <li>
                  Do <span className="font-bold text-red-600">NOT</span> include the expiry date in the file
                </li>
                <li>
                  Save the completed file to your bot's filesystem
                </li>
              </ol>
            </div>

            <label className="flex items-start gap-3 cursor-pointer p-3 rounded-lg hover:bg-neutral-50 transition-colors">
              <input
                type="checkbox"
                checked={confirmed}
                onChange={(e) => setConfirmed(e.target.checked)}
                className="mt-0.5 w-4 h-4 rounded border-neutral-300 text-emerald-600 focus:ring-emerald-500"
                data-testid="checkbox-confirm-setup"
              />
              <span className="text-sm text-neutral-700">
                I've filled in my card details and saved the file to my bot's system.
              </span>
            </label>

            <div className="flex justify-between">
              <Button variant="ghost" onClick={() => setStep(1)} data-testid="button-wizard-back-2">
                <ChevronLeft className="w-4 h-4 mr-1" /> Back
              </Button>
              <Button onClick={() => setStep(3)} disabled={!confirmed} data-testid="button-wizard-next-2">
                Next <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
          </div>
        ) : step === 3 ? (
          <div className="space-y-4 py-2">
            <p className="text-sm text-neutral-500">
              Enter the 3 digits you left as XXX, plus your card's expiry date, name, and zip code. CreditClaw stores these securely — your bot never sees them.
            </p>

            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="missing-digits">
                  Missing 3 Digits (positions {initData?.missing_digit_positions?.join(", ")})
                </Label>
                <Input
                  id="missing-digits"
                  value={missingDigits}
                  onChange={(e) => setMissingDigits(e.target.value.replace(/\D/g, "").slice(0, 3))}
                  placeholder="e.g. 847"
                  maxLength={3}
                  className="font-mono text-lg tracking-widest"
                  data-testid="input-missing-digits"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Expiry Month</Label>
                  <Select value={expiryMonth} onValueChange={setExpiryMonth}>
                    <SelectTrigger data-testid="select-expiry-month">
                      <SelectValue placeholder="Month" />
                    </SelectTrigger>
                    <SelectContent>
                      {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                        <SelectItem key={m} value={m.toString()}>
                          {m.toString().padStart(2, "0")}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Expiry Year</Label>
                  <Select value={expiryYear} onValueChange={setExpiryYear}>
                    <SelectTrigger data-testid="select-expiry-year">
                      <SelectValue placeholder="Year" />
                    </SelectTrigger>
                    <SelectContent>
                      {Array.from({ length: 10 }, (_, i) => new Date().getFullYear() + i).map((y) => (
                        <SelectItem key={y} value={y.toString()}>
                          {y}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="owner-name">Cardholder Name</Label>
                <Input
                  id="owner-name"
                  value={ownerName}
                  onChange={(e) => setOwnerName(e.target.value)}
                  placeholder="Jane Smith"
                  data-testid="input-owner-name"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="owner-zip">Billing Zip Code</Label>
                <Input
                  id="owner-zip"
                  value={ownerZip}
                  onChange={(e) => setOwnerZip(e.target.value)}
                  placeholder="90210"
                  maxLength={10}
                  data-testid="input-owner-zip"
                />
              </div>
            </div>

            <div className="flex justify-between">
              <Button variant="ghost" onClick={() => setStep(2)} data-testid="button-wizard-back-3">
                <ChevronLeft className="w-4 h-4 mr-1" /> Back
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={!isSubmitValid || submitting}
                data-testid="button-wizard-submit"
              >
                {submitting ? (
                  <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Submitting...</>
                ) : (
                  <>Activate Card <CheckCircle className="w-4 h-4 ml-1" /></>
                )}
              </Button>
            </div>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
