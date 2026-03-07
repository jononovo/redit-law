"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { CheckCircle2, Loader2, ArrowRight, ArrowLeft, CreditCard, Shield, Download, Lock, Bot, Sparkles, ChevronDown, X, RotateCcw, Copy, Send, MessageCircle, ExternalLink } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { authFetch } from "@/lib/auth-fetch";
import { encryptCardDetails, buildEncryptedCardFile, downloadEncryptedFile } from "@/lib/card/onboarding-rail5/encrypt";
import { detectCardBrand, brandToApiValue, getMaxDigits, type CardBrand } from "@/lib/card/card-brand";
import { Rail5InteractiveCard } from "@/lib/card/onboarding-rail5/interactive-card";
import { type CardFieldErrors } from "@/lib/card/hooks";
import { RAIL5_CARD_DELIVERED } from "@/lib/agent-management/bot-messaging/templates";

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

interface SavedCardDetails {
  cardNumber: string;
  cardExpiry: string;
  cardCvv: string;
  cardholderName: string;
  billingAddress: string;
  billingCity: string;
  billingState: string;
  billingZip: string;
}

interface TestVerificationField {
  match: boolean;
}

interface TestPurchaseApiResponse {
  status: "pending" | "completed";
  sale_id?: string;
  submitted_details?: {
    cardNumber: string;
    cardExpiry: string;
    cardCvv: string;
    cardholderName: string;
    billingAddress: string;
    billingCity: string;
    billingState: string;
    billingZip: string;
  };
}

interface TestPurchaseResult {
  status: "pending" | "completed";
  sale_id?: string;
  verified?: boolean;
  fields?: Record<string, TestVerificationField>;
}

interface Step7Props {
  cardId: string;
  cardName: string;
  cardLast4: string;
  spendingLimit: string;
  dailyLimit: string;
  monthlyLimit: string;
  selectedBotId: string;
  bots: BotOption[];
  directDeliverySucceeded: boolean;
  deliveryResult: { delivered: boolean; method: string; messageId?: number; expiresAt?: string } | null;
  storedFileContent: string;
  savedCardDetails: SavedCardDetails | null;
  onDone: () => void;
}

const FIELD_LABELS: Record<string, string> = {
  card_number: "Card Number",
  card_expiry: "Expiry",
  card_cvv: "CVV",
  cardholder_name: "Cardholder Name",
  billing_address: "Address",
  billing_city: "City",
  billing_state: "State",
  billing_zip: "ZIP Code",
};

function Step7DeliveryResult({
  cardId, cardName, cardLast4, spendingLimit, dailyLimit, monthlyLimit,
  selectedBotId, bots, directDeliverySucceeded, deliveryResult, storedFileContent, savedCardDetails, onDone,
}: Step7Props) {
  const { toast } = useToast();
  const [botConfirmed, setBotConfirmed] = useState(false);
  const [pollingDone, setPollingDone] = useState(false);
  const [copied, setCopied] = useState(false);
  const [discordCopied, setDiscordCopied] = useState(false);
  const [showAgentSection, setShowAgentSection] = useState(false);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef(Date.now());

  const [testPurchaseResult, setTestPurchaseResult] = useState<TestPurchaseResult | null>(null);
  const [testPollingActive, setTestPollingActive] = useState(false);
  const [testPollingTimedOut, setTestPollingTimedOut] = useState(false);
  const testPollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const testStartRef = useRef(0);

  const isWaiting = selectedBotId && !directDeliverySucceeded && !botConfirmed;

  const relayMessage = RAIL5_CARD_DELIVERED;

  useEffect(() => {
    if (!selectedBotId || !cardId || directDeliverySucceeded) return;

    startTimeRef.current = Date.now();

    const poll = async () => {
      try {
        const res = await authFetch(`/api/v1/rail5/cards/${cardId}/delivery-status`);
        if (res.ok) {
          const data = await res.json();
          if (data.status === "confirmed" || data.status === "active") {
            setBotConfirmed(true);
            if (pollingRef.current) clearInterval(pollingRef.current);
          }
        }
      } catch {}

      if (!pollingDone && Date.now() - startTimeRef.current >= 60_000) {
        setPollingDone(true);
      }
    };

    pollingRef.current = setInterval(poll, 5000);
    poll();

    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, [selectedBotId, cardId, directDeliverySucceeded]);

  const deliveryConfirmed = directDeliverySucceeded || botConfirmed;

  useEffect(() => {
    if (!deliveryConfirmed || !savedCardDetails || !cardId) return;
    if (testPurchaseResult?.status === "completed") return;

    setTestPollingActive(true);
    testStartRef.current = Date.now();

    const normalize = (v: string | undefined | null) => (v || "").trim().toLowerCase();

    const compareFields = (submitted: TestPurchaseApiResponse["submitted_details"]): TestPurchaseResult => {
      if (!submitted) return { status: "completed", verified: false, fields: {} };
      const fields: Record<string, TestVerificationField> = {
        card_number: { match: normalize(submitted.cardNumber) === normalize(savedCardDetails.cardNumber) },
        card_expiry: { match: normalize(submitted.cardExpiry) === normalize(savedCardDetails.cardExpiry) },
        card_cvv: { match: normalize(submitted.cardCvv) === normalize(savedCardDetails.cardCvv) },
        cardholder_name: { match: normalize(submitted.cardholderName) === normalize(savedCardDetails.cardholderName) },
        billing_address: { match: normalize(submitted.billingAddress) === normalize(savedCardDetails.billingAddress) },
        billing_city: { match: normalize(submitted.billingCity) === normalize(savedCardDetails.billingCity) },
        billing_state: { match: normalize(submitted.billingState) === normalize(savedCardDetails.billingState) },
        billing_zip: { match: normalize(submitted.billingZip) === normalize(savedCardDetails.billingZip) },
      };
      return {
        status: "completed",
        verified: Object.values(fields).every((f) => f.match),
        fields,
      };
    };

    const pollTest = async () => {
      try {
        const res = await authFetch(`/api/v1/rail5/cards/${cardId}/test-purchase-status`);
        if (res.ok) {
          const data: TestPurchaseApiResponse = await res.json();
          if (data.status === "completed" && data.submitted_details) {
            const result = compareFields(data.submitted_details);
            result.sale_id = data.sale_id;
            setTestPurchaseResult(result);
            setTestPollingActive(false);
            if (testPollingRef.current) clearInterval(testPollingRef.current);
          }
        }
      } catch {}

      if (Date.now() - testStartRef.current >= 180_000) {
        setTestPollingTimedOut(true);
        setTestPollingActive(false);
        if (testPollingRef.current) clearInterval(testPollingRef.current);
      }
    };

    testPollingRef.current = setInterval(pollTest, 5000);
    pollTest();

    return () => {
      if (testPollingRef.current) clearInterval(testPollingRef.current);
    };
  }, [deliveryConfirmed, savedCardDetails, cardId, testPurchaseResult?.status]);

  function handleCopy() {
    navigator.clipboard.writeText(relayMessage).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  function handleTelegram() {
    const url = `https://t.me/share/url?text=${encodeURIComponent(relayMessage)}`;
    window.open(url, "_blank");
  }

  function handleDiscord() {
    navigator.clipboard.writeText(relayMessage).then(() => {
      setDiscordCopied(true);
      toast({ title: "Copied!", description: "Paste this in Discord to send to your bot." });
      setTimeout(() => setDiscordCopied(false), 2000);
    });
  }

  function handleRedownload() {
    if (!storedFileContent) return;
    downloadEncryptedFile(storedFileContent, `Card-${cardName.replace(/[^a-zA-Z0-9-]/g, "")}-${cardLast4}.md`);
  }

  const botDisplayName = bots.find(b => b.bot_id === selectedBotId)?.bot_name || selectedBotId;

  return (
    <div className="space-y-6" data-testid="r5-step-success">
      <div className="text-center">
        {directDeliverySucceeded ? (
          <>
            <div className="w-16 h-16 rounded-2xl bg-green-50 flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 className="w-8 h-8 text-green-600" />
            </div>
            <h2 className="text-2xl font-bold text-neutral-900" data-testid="text-delivery-title">Bot Received the Card</h2>
            <p className="text-sm text-neutral-500 mt-2">Your encrypted card file was delivered to {botDisplayName} via webhook.</p>
          </>
        ) : botConfirmed ? (
          <>
            <div className="w-16 h-16 rounded-2xl bg-green-50 flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 className="w-8 h-8 text-green-600" />
            </div>
            <h2 className="text-2xl font-bold text-neutral-900" data-testid="text-delivery-title">Bot Confirmed!</h2>
            <p className="text-sm text-neutral-500 mt-2">{botDisplayName} picked up and confirmed the card file.</p>
          </>
        ) : isWaiting ? (
          <>
            <div className="w-16 h-16 rounded-2xl bg-amber-50 flex items-center justify-center mx-auto mb-4">
              {pollingDone ? (
                <Send className="w-8 h-8 text-amber-600" />
              ) : (
                <Loader2 className="w-8 h-8 text-amber-600 animate-spin" />
              )}
            </div>
            <h2 className="text-2xl font-bold text-neutral-900" data-testid="text-delivery-title">
              {pollingDone ? "File Staged for Your Bot" : "Waiting for Your Bot..."}
            </h2>
            <p className="text-sm text-neutral-500 mt-2">
              {pollingDone
                ? "Your encrypted card file is staged for 24 hours. Your bot can pick it up anytime."
                : "Your encrypted card file is ready for pickup. Tell your bot to check for messages."}
            </p>
          </>
        ) : (
          <>
            <div className="w-16 h-16 rounded-2xl bg-green-50 flex items-center justify-center mx-auto mb-4">
              <Sparkles className="w-8 h-8 text-green-600" />
            </div>
            <h2 className="text-2xl font-bold text-neutral-900" data-testid="text-delivery-title">Card Ready!</h2>
            <p className="text-sm text-neutral-500 mt-2">Your encrypted card has been set up successfully.</p>
          </>
        )}
      </div>

      {isWaiting && (
        <div className="space-y-3">
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
            <p className="text-xs text-amber-700 font-medium mb-2">Send this to your bot:</p>
            <pre className="text-xs text-amber-900 whitespace-pre-wrap font-mono bg-amber-100/50 rounded-lg p-3" data-testid="text-relay-message">
              {relayMessage}
            </pre>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              className="flex-1 gap-1.5 text-xs h-9"
              onClick={handleCopy}
              data-testid="button-share-copy"
            >
              <Copy className="w-3.5 h-3.5" />
              {copied ? "Copied!" : "Copy"}
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="flex-1 gap-1.5 text-xs h-9"
              onClick={handleTelegram}
              data-testid="button-share-telegram"
            >
              <Send className="w-3.5 h-3.5" />
              Telegram
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="flex-1 gap-1.5 text-xs h-9"
              onClick={handleDiscord}
              data-testid="button-share-discord"
            >
              <MessageCircle className="w-3.5 h-3.5" />
              {discordCopied ? "Copied!" : "Discord"}
            </Button>
          </div>
        </div>
      )}

      {deliveryConfirmed && savedCardDetails && (
        <div className="space-y-3" data-testid="r5-test-verification">
          {testPurchaseResult?.status === "completed" ? (
            <div className={`rounded-xl p-4 border ${testPurchaseResult.verified ? "bg-green-50 border-green-200" : "bg-red-50 border-red-200"}`}>
              <div className="flex items-center gap-2 mb-3">
                {testPurchaseResult.verified ? (
                  <CheckCircle2 className="w-5 h-5 text-green-600" />
                ) : (
                  <Shield className="w-5 h-5 text-red-600" />
                )}
                <span className={`font-semibold text-sm ${testPurchaseResult.verified ? "text-green-800" : "text-red-800"}`} data-testid="text-verification-result">
                  {testPurchaseResult.verified
                    ? "Card Verified — encryption and decryption working correctly"
                    : "Verification Failed — some fields did not match"}
                </span>
              </div>
              {testPurchaseResult.fields && (
                <div className="grid grid-cols-2 gap-1.5">
                  {Object.entries(testPurchaseResult.fields).map(([field, result]) => (
                    <div key={field} className="flex items-center gap-1.5 text-xs" data-testid={`verification-field-${field}`}>
                      {result.match ? (
                        <CheckCircle2 className="w-3.5 h-3.5 text-green-600 flex-shrink-0" />
                      ) : (
                        <X className="w-3.5 h-3.5 text-red-600 flex-shrink-0" />
                      )}
                      <span className={result.match ? "text-green-700" : "text-red-700"}>
                        {FIELD_LABELS[field] || field}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : testPollingTimedOut ? (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
              <div className="flex items-center gap-2">
                <Shield className="w-5 h-5 text-amber-600" />
                <span className="font-medium text-sm text-amber-800" data-testid="text-verification-timeout">
                  Test purchase not completed yet
                </span>
              </div>
              <p className="text-xs text-amber-600 mt-1">
                The bot hasn't completed the test checkout within 3 minutes. It may still complete it later — you can check the card's dashboard for results.
              </p>
            </div>
          ) : testPollingActive ? (
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
              <div className="flex items-center gap-2">
                <Loader2 className="w-5 h-5 text-blue-600 animate-spin" />
                <span className="font-medium text-sm text-blue-800" data-testid="text-verification-pending">
                  Verifying card — waiting for test purchase...
                </span>
              </div>
              <p className="text-xs text-blue-600 mt-1">
                Your bot is completing a test checkout to verify the card decrypts correctly. This may take a few minutes.
              </p>
            </div>
          ) : null}
        </div>
      )}

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
              ? `${botDisplayName}${directDeliverySucceeded || botConfirmed ? " — Card delivered" : ""}`
              : "Not linked yet"}
          </span>
        </div>
      </div>

      <div className="relative">
        <div className="bg-neutral-900 rounded-xl p-4 text-xs font-mono text-neutral-300 whitespace-pre-wrap leading-relaxed" data-testid="text-card-info">
          {`Card ID: ${cardId}\nCard: ${cardName} (••••${cardLast4})\nPer-Checkout Limit: $${spendingLimit}\nDaily / Monthly: $${dailyLimit} / $${monthlyLimit}\n\ncard_id is always available via GET /api/v1/bot/status.\nAt checkout, use POST /api/v1/bot/rail5/checkout\nRequest decryption key via GET /api/v1/bot/rail5/key\nFull guide: https://creditclaw.com/skill.md (Rail 5 section)`}
        </div>
        <Button
          variant="outline"
          size="sm"
          className="absolute top-2 right-2 text-xs h-7 bg-neutral-800 border-neutral-700 text-neutral-300 hover:bg-neutral-700 hover:text-white"
          data-testid="button-r5-copy-info"
          onClick={() => {
            navigator.clipboard.writeText(
              `Card ID: ${cardId}\nCard: ${cardName} (••••${cardLast4})\nPer-Checkout Limit: $${spendingLimit}\nDaily / Monthly: $${dailyLimit} / $${monthlyLimit}\n\ncard_id is always available via GET /api/v1/bot/status.\nAt checkout, use POST /api/v1/bot/rail5/checkout\nRequest decryption key via GET /api/v1/bot/rail5/key\nFull guide: https://creditclaw.com/skill.md (Rail 5 section)`
            ).then(() => {
              toast({ title: "Copied to clipboard" });
            });
          }}
        >
          <Copy className="w-3 h-3 mr-1" /> Copy
        </Button>
      </div>

      <div>
        <button
          className="text-xs text-neutral-400 hover:text-neutral-600 transition-colors flex items-center gap-1"
          onClick={() => setShowAgentSection(!showAgentSection)}
          data-testid="button-r5-agent-section-toggle"
        >
          <ChevronDown className={`w-3 h-3 transition-transform ${showAgentSection ? "rotate-180" : ""}`} />
          For AI Agents or manual file placement
        </button>
        {showAgentSection && (
          <div className="mt-3 space-y-3 bg-neutral-50 rounded-xl p-4 text-sm">
            <div>
              <p className="font-medium text-neutral-700 text-xs mb-1">For OpenClaw Bots</p>
              <p className="text-xs text-neutral-500">
                Place the downloaded file in your bot's <code className="bg-neutral-200 px-1 py-0.5 rounded text-[10px]">.creditclaw/cards/</code> folder.
                The file is self-contained — your bot can read the instructions at the top.
              </p>
            </div>
            <div>
              <p className="font-medium text-neutral-700 text-xs mb-1">For Applications with API</p>
              <p className="text-xs text-neutral-500">
                See the full Rail 5 integration guide:{" "}
                <a href="https://creditclaw.com/skill.md#rail-5" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline inline-flex items-center gap-0.5">
                  creditclaw.com/skill.md <ExternalLink className="w-2.5 h-2.5" />
                </a>.
                Use <code className="bg-neutral-200 px-1 py-0.5 rounded text-[10px]">GET /bot/messages</code> to fetch card files programmatically.
              </p>
            </div>
            {storedFileContent && (
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 text-xs"
                onClick={handleRedownload}
                data-testid="button-r5-redownload"
              >
                <Download className="w-3.5 h-3.5" />
                Re-download file
              </Button>
            )}
          </div>
        )}
      </div>

      <Button onClick={onDone} className="w-full gap-2 bg-green-600 hover:bg-green-700" data-testid="button-r5-done">
        <CheckCircle2 className="w-4 h-4" /> Done
      </Button>
    </div>
  );
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
  const [addressErrors, setAddressErrors] = useState<{ address?: boolean; city?: boolean; zip?: boolean }>({});

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
  const [deliveryResult, setDeliveryResult] = useState<{ delivered: boolean; method: string; messageId?: number; expiresAt?: string } | null>(null);
  const [storedFileContent, setStoredFileContent] = useState("");
  const [copied, setCopied] = useState(false);
  const [cardEncrypting, setCardEncrypting] = useState(false);
  const [cardEncrypted, setCardEncrypted] = useState(false);

  const [savedCardDetails, setSavedCardDetails] = useState<{
    cardNumber: string; cardExpiry: string; cardCvv: string;
    cardholderName: string; billingAddress: string; billingCity: string;
    billingState: string; billingZip: string;
  } | null>(null);

  function handleEncryptCard() {
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
    setCardEncrypting(true);
    setTimeout(() => {
      setCardEncrypting(false);
      setCardEncrypted(true);
    }, 2000);
  }

  function handleRestartCard() {
    setCardEncrypting(false);
    setCardEncrypted(false);
    setCardNumber("");
    setCardCvv("");
    setExpMonth("");
    setExpYear("");
    setHolderName("");
    setCardErrors({});
  }

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
    setCardEncrypting(false);
    setCardEncrypted(false);
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
    setDeliveryResult(null);
    setStoredFileContent("");
    setCopied(false);
    setCardErrors({});
    setAddressErrors({});
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

      const md = buildEncryptedCardFile(ciphertextBytes, cardName, cardLast4, cardId);
      setStoredFileContent(md);

      if (selectedBotId) {
        setDeliveryAttempted(true);
        try {
          const deliverRes = await authFetch("/api/v1/bot-messages/send", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              bot_id: selectedBotId,
              event_type: "rail5.card.delivered",
              payload: {
                card_id: cardId,
                card_name: cardName,
                card_last4: cardLast4,
                file_content: md,
                suggested_path: `.creditclaw/cards/${cardId}.md`,
                instructions: RAIL5_CARD_DELIVERED,
              },
            }),
          });
          if (deliverRes.ok) {
            const deliverData = await deliverRes.json();
            setDeliveryResult(deliverData);
            if (deliverData.delivered) {
              setDirectDeliverySucceeded(true);
            }
          }
        } catch {
        }
      }

      downloadEncryptedFile(md, `Card-${cardName.replace(/[^a-zA-Z0-9-]/g, "")}-${cardLast4}.md`);
      setDownloadDone(true);

      setSavedCardDetails({
        cardNumber: cardNumber.replace(/\s/g, ""),
        cardExpiry: `${expMonth.padStart(2, "0")}/${expYear.length === 4 ? expYear.slice(-2) : expYear}`,
        cardCvv: cardCvv,
        cardholderName: holderName,
        billingAddress: address,
        billingCity: city,
        billingState: state,
        billingZip: zip,
      });

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
    setStep(4);
  }

  function handleAddressNext() {
    const errs: { address?: boolean; city?: boolean; zip?: boolean } = {
      address: !address.trim(),
      city: !city.trim(),
      zip: !zip.trim(),
    };
    if (Object.values(errs).some(Boolean)) {
      setAddressErrors(errs);
      return;
    }
    setAddressErrors({});
    setStep(5);
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
      setStep(3);
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

        {step === 3 && (
          <div className="space-y-6" data-testid="r5-step-card-entry">
            <div className="text-center">
              <div className="w-12 h-12 rounded-2xl bg-blue-50 flex items-center justify-center mx-auto mb-3">
                <Lock className="w-6 h-6 text-blue-600" />
              </div>
              <h2 className="text-xl font-bold text-neutral-900">Enter Card Details</h2>
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
              isEncrypting={cardEncrypting || cardEncrypted}
            />

            <div className="flex gap-3">
              {(cardEncrypting || cardEncrypted) ? (
                <Button
                  variant="outline"
                  onClick={handleRestartCard}
                  className="flex-1 gap-2"
                  data-testid="button-r5-restart-card"
                >
                  <RotateCcw className="w-4 h-4" /> Clear Card
                </Button>
              ) : (
                <Button
                  variant="outline"
                  onClick={() => setStep(2)}
                  className="flex-1 gap-2"
                  data-testid="button-r5-step3-back"
                >
                  <ArrowLeft className="w-4 h-4" /> Back
                </Button>
              )}
              <Button
                onClick={cardEncrypted ? handleCardDetailsNext : handleEncryptCard}
                disabled={cardEncrypting}
                className={`flex-1 gap-2 font-semibold py-3 rounded-xl shadow-lg transition-all ${
                  cardEncrypted
                    ? "bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white shadow-green-600/25"
                    : "bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-blue-600/25"
                }`}
                data-testid="button-r5-encrypt-card"
              >
                {cardEncrypted ? (
                  <>
                    Encrypted <ArrowRight className="w-4 h-4" />
                  </>
                ) : cardEncrypting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" /> Encrypting...
                  </>
                ) : (
                  <>
                    <Lock className="w-4 h-4" /> Encrypt
                  </>
                )}
              </Button>
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="space-y-6" data-testid="r5-step-address">
            <div className="text-center">
              <div className="w-12 h-12 rounded-2xl bg-indigo-50 flex items-center justify-center mx-auto mb-3">
                <CreditCard className="w-6 h-6 text-indigo-600" />
              </div>
              <h2 className="text-xl font-bold text-neutral-900">Billing Address</h2>
            </div>

            <div className="space-y-4">
              <div>
                <Label htmlFor="r5-address">Street Address</Label>
                <Input
                  id="r5-address"
                  placeholder="123 Main St"
                  value={address}
                  onChange={(e) => { setAddress(e.target.value); setAddressErrors((p) => ({ ...p, address: false })); }}
                  className={addressErrors.address ? "form-field-error" : ""}
                  data-testid="input-r5-address"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <Label htmlFor="r5-city">City</Label>
                  <Input id="r5-city" placeholder="New York" value={city} onChange={(e) => { setCity(e.target.value); setAddressErrors((p) => ({ ...p, city: false })); }} className={addressErrors.city ? "form-field-error" : ""} data-testid="input-r5-city" />
                </div>
                <div>
                  <Label htmlFor="r5-state">State</Label>
                  <Input id="r5-state" placeholder="NY" maxLength={2} value={state} onChange={(e) => setState(e.target.value.toUpperCase().slice(0, 2))} data-testid="input-r5-state" />
                </div>
                <div>
                  <Label htmlFor="r5-zip">ZIP</Label>
                  <Input id="r5-zip" placeholder="10001" value={zip} onChange={(e) => { setZip(e.target.value.replace(/\D/g, "").slice(0, 10)); setAddressErrors((p) => ({ ...p, zip: false })); }} className={addressErrors.zip ? "form-field-error" : ""} data-testid="input-r5-zip" />
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
              <Button variant="outline" onClick={() => setStep(3)} className="flex-1 gap-2" data-testid="button-r5-step5-back">
                <ArrowLeft className="w-4 h-4" /> Back
              </Button>
              <Button onClick={handleAddressNext} className="flex-1 gap-2" data-testid="button-r5-step5-next">
                Next <ArrowRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}

        {step === 2 && /* Spending Limits */ (
          <div className="space-y-6" data-testid="r5-step-limits">
            <div className="text-center">
              <div className="w-12 h-12 rounded-2xl bg-orange-50 flex items-center justify-center mx-auto mb-3">
                <Shield className="w-6 h-6 text-orange-600" />
              </div>
              <h2 className="text-xl font-bold text-neutral-900">Spending Limits</h2>
              <p className="text-sm text-neutral-500 mt-1">Set hardened guardrails for how your bot can spend.</p>
            </div>

            <div className="grid grid-cols-2 gap-4">
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
                  className="data-[state=checked]:bg-success"
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
              <Button variant="outline" onClick={() => setStep(1)} className="flex-1 gap-2" data-testid="button-r5-step3-back">
                <ArrowLeft className="w-4 h-4" /> Back
              </Button>
              <Button onClick={handleLimitsNext} disabled={loading} className="flex-1 gap-2" data-testid="button-r5-step3-next">
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
                    {directDeliverySucceeded ? <CheckCircle2 className="w-4 h-4 text-white" /> : deliveryAttempted ? <CheckCircle2 className="w-4 h-4 text-white" /> : <span className="text-xs text-neutral-500">3</span>}
                  </div>
                  <span className="text-sm text-neutral-700">
                    {directDeliverySucceeded
                      ? "Delivered to bot via webhook"
                      : deliveryAttempted
                        ? "File staged for bot pickup"
                        : "Send encrypted file to bot"}
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
          <Step7DeliveryResult
            cardId={cardId}
            cardName={cardName}
            cardLast4={cardLast4}
            spendingLimit={spendingLimit}
            dailyLimit={dailyLimit}
            monthlyLimit={monthlyLimit}
            selectedBotId={selectedBotId}
            bots={bots}
            directDeliverySucceeded={directDeliverySucceeded}
            deliveryResult={deliveryResult}
            storedFileContent={storedFileContent}
            savedCardDetails={savedCardDetails}
            onDone={handleDone}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
