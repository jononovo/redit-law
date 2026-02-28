"use client";

import { useState, useEffect, useCallback } from "react";
import { Loader2, PlusCircle, Copy, Check, Link2, Lock, Unlock, DollarSign, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { StatusBadge } from "@/components/wallet/status-badge";
import { useAuth } from "@/lib/auth/auth-context";
import { authFetch } from "@/lib/auth-fetch";

interface WalletOption {
  id: number;
  bot_id: string;
  bot_name: string;
  address: string;
  balance_display: string;
}

interface CheckoutPageData {
  checkout_page_id: string;
  title: string;
  description: string | null;
  wallet_id: number;
  wallet_address: string;
  amount_usd: number | null;
  amount_locked: boolean;
  allowed_methods: string[];
  status: string;
  payment_count: number;
  total_received_usd: number;
  checkout_url: string;
  created_at: string;
  expires_at: string | null;
}

const PAYMENT_METHODS = [
  { value: "x402", label: "x402 Protocol" },
  { value: "usdc_direct", label: "USDC Direct" },
  { value: "stripe_onramp", label: "Stripe Onramp (Card/Bank)" },
];

export default function CreateCheckoutPage() {
  const { user } = useAuth();
  const [wallets, setWallets] = useState<WalletOption[]>([]);
  const [checkoutPages, setCheckoutPages] = useState<CheckoutPageData[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [walletId, setWalletId] = useState("");
  const [amountUsd, setAmountUsd] = useState("");
  const [amountLocked, setAmountLocked] = useState(true);
  const [allowedMethods, setAllowedMethods] = useState<string[]>(["x402", "usdc_direct", "stripe_onramp"]);
  const [successUrl, setSuccessUrl] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [expiresAt, setExpiresAt] = useState("");

  const [createdUrl, setCreatedUrl] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const [walletsRes, pagesRes] = await Promise.all([
        authFetch("/api/v1/stripe-wallet/list"),
        authFetch("/api/v1/checkout-pages"),
      ]);

      if (walletsRes.ok) {
        const data = await walletsRes.json();
        setWallets(
          (data.wallets || [])
            .filter((w: any) => w.status === "active")
            .map((w: any) => ({
              id: w.id,
              bot_id: w.bot_id,
              bot_name: w.bot_name,
              address: w.address,
              balance_display: w.balance_display,
            }))
        );
      }

      if (pagesRes.ok) {
        const data = await pagesRes.json();
        setCheckoutPages(data.checkout_pages || []);
      }
    } catch {
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user) {
      fetchData();
    }
  }, [user, fetchData]);

  const toggleMethod = (method: string) => {
    setAllowedMethods((prev) => {
      if (prev.includes(method)) {
        if (prev.length <= 1) return prev;
        return prev.filter((m) => m !== method);
      }
      return [...prev, method];
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !walletId) return;

    setSubmitting(true);
    setCreatedUrl(null);

    try {
      const body: Record<string, any> = {
        title: title.trim(),
        wallet_id: Number(walletId),
        amount_locked: amountLocked,
        allowed_methods: allowedMethods,
      };

      if (description.trim()) body.description = description.trim();
      if (amountUsd) body.amount_usd = parseFloat(amountUsd);
      if (successUrl.trim()) body.success_url = successUrl.trim();
      if (successMessage.trim()) body.success_message = successMessage.trim();
      if (expiresAt) body.expires_at = new Date(expiresAt).toISOString();

      const res = await authFetch("/api/v1/checkout-pages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        const data = await res.json();
        const fullUrl = `${window.location.origin}${data.checkout_url}`;
        setCreatedUrl(fullUrl);

        setTitle("");
        setDescription("");
        setAmountUsd("");
        setAmountLocked(true);
        setAllowedMethods(["x402", "usdc_direct", "stripe_onramp"]);
        setSuccessUrl("");
        setSuccessMessage("");
        setExpiresAt("");

        fetchData();
      }
    } catch {
    } finally {
      setSubmitting(false);
    }
  };

  const copyToClipboard = async (text: string, id: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-neutral-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="create-checkout-page">
      <div>
        <h1 className="text-2xl font-bold text-neutral-900" data-testid="text-create-checkout-title">
          Create Checkout Page
        </h1>
        <p className="text-sm text-neutral-500 mt-1">
          Create a checkout page to accept payments from anyone
        </p>
      </div>

      <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-neutral-100 p-6 space-y-5" data-testid="form-create-checkout">
        <div className="space-y-1.5">
          <Label htmlFor="title" className="text-sm font-medium text-neutral-700">
            Title <span className="text-red-500">*</span>
          </Label>
          <Input
            id="title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. API Access Plan"
            required
            data-testid="input-checkout-title"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="description" className="text-sm font-medium text-neutral-700">
            Description
          </Label>
          <Textarea
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Describe what this checkout is for..."
            rows={3}
            data-testid="input-checkout-description"
          />
        </div>

        <div className="space-y-1.5">
          <Label className="text-sm font-medium text-neutral-700">
            Wallet <span className="text-red-500">*</span>
          </Label>
          {wallets.length === 0 ? (
            <p className="text-sm text-neutral-400">No active wallets found. Create a Stripe Wallet first.</p>
          ) : (
            <Select value={walletId} onValueChange={setWalletId}>
              <SelectTrigger data-testid="select-checkout-wallet">
                <SelectValue placeholder="Select a wallet" />
              </SelectTrigger>
              <SelectContent>
                {wallets.map((w) => (
                  <SelectItem key={w.id} value={String(w.id)}>
                    {w.bot_name} — {w.address.slice(0, 6)}...{w.address.slice(-4)} ({w.balance_display})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="amount" className="text-sm font-medium text-neutral-700">
              Amount (USD)
            </Label>
            <Input
              id="amount"
              type="number"
              step="0.01"
              min="0"
              value={amountUsd}
              onChange={(e) => setAmountUsd(e.target.value)}
              placeholder="Leave blank for open amount"
              data-testid="input-checkout-amount"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-sm font-medium text-neutral-700">Lock Amount</Label>
            <div className="flex items-center gap-2 pt-2">
              <Switch
                checked={amountLocked}
                onCheckedChange={setAmountLocked}
                data-testid="switch-amount-locked"
              />
              <span className="text-sm text-neutral-500 flex items-center gap-1">
                {amountLocked ? (
                  <>
                    <Lock className="w-3.5 h-3.5" /> Locked
                  </>
                ) : (
                  <>
                    <Unlock className="w-3.5 h-3.5" /> Buyer can change
                  </>
                )}
              </span>
            </div>
          </div>
        </div>

        <div className="space-y-1.5">
          <Label className="text-sm font-medium text-neutral-700">Payment Methods</Label>
          <div className="flex flex-wrap gap-4 pt-1">
            {PAYMENT_METHODS.map((method) => (
              <label key={method.value} className="flex items-center gap-2 cursor-pointer">
                <Checkbox
                  checked={allowedMethods.includes(method.value)}
                  onCheckedChange={() => toggleMethod(method.value)}
                  data-testid={`checkbox-method-${method.value}`}
                />
                <span className="text-sm text-neutral-700">{method.label}</span>
              </label>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="successUrl" className="text-sm font-medium text-neutral-700">
              Custom Success URL
            </Label>
            <Input
              id="successUrl"
              type="url"
              value={successUrl}
              onChange={(e) => setSuccessUrl(e.target.value)}
              placeholder="https://..."
              data-testid="input-success-url"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="successMessage" className="text-sm font-medium text-neutral-700">
              Custom Success Message
            </Label>
            <Input
              id="successMessage"
              value={successMessage}
              onChange={(e) => setSuccessMessage(e.target.value)}
              placeholder="Thank you for your purchase!"
              data-testid="input-success-message"
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="expiresAt" className="text-sm font-medium text-neutral-700">
            Expiry
          </Label>
          <Input
            id="expiresAt"
            type="datetime-local"
            value={expiresAt}
            onChange={(e) => setExpiresAt(e.target.value)}
            data-testid="input-expires-at"
          />
        </div>

        <Button
          type="submit"
          disabled={submitting || !title.trim() || !walletId}
          className="w-full gap-2"
          data-testid="button-create-checkout"
        >
          {submitting ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <PlusCircle className="w-4 h-4" />
          )}
          Create Checkout Page
        </Button>
      </form>

      {createdUrl && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex items-center justify-between gap-3" data-testid="created-checkout-url">
          <div className="flex items-center gap-2 min-w-0">
            <Link2 className="w-5 h-5 text-green-600 flex-shrink-0" />
            <span className="text-sm font-medium text-green-800 truncate">{createdUrl}</span>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => copyToClipboard(createdUrl, "created")}
            className="flex-shrink-0 gap-1"
            data-testid="button-copy-created-url"
          >
            {copiedId === "created" ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
            {copiedId === "created" ? "Copied" : "Copy"}
          </Button>
        </div>
      )}

      <div>
        <h2 className="text-lg font-semibold text-neutral-900 mb-3" data-testid="text-existing-checkouts-title">
          Existing Checkout Pages
        </h2>

        {checkoutPages.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-xl border border-neutral-100" data-testid="text-no-checkouts">
            <DollarSign className="w-10 h-10 mx-auto text-neutral-300 mb-3" />
            <h3 className="text-base font-semibold text-neutral-700">No checkout pages yet</h3>
            <p className="text-sm text-neutral-500 mt-1">Create one above to start accepting payments</p>
          </div>
        ) : (
          <div className="space-y-3" data-testid="checkout-pages-list">
            {checkoutPages.map((page) => {
              const fullUrl = `${typeof window !== "undefined" ? window.location.origin : ""}${page.checkout_url}`;
              return (
                <div
                  key={page.checkout_page_id}
                  className="bg-white rounded-xl border border-neutral-100 p-4"
                  data-testid={`checkout-page-card-${page.checkout_page_id}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="font-medium text-sm text-neutral-900 truncate" data-testid={`text-checkout-title-${page.checkout_page_id}`}>
                          {page.title}
                        </h3>
                        <StatusBadge status={page.status} />
                      </div>
                      {page.description && (
                        <p className="text-xs text-neutral-500 mt-0.5 line-clamp-1">{page.description}</p>
                      )}
                      <div className="flex items-center gap-3 mt-2 text-xs text-neutral-400">
                        <span data-testid={`text-checkout-amount-${page.checkout_page_id}`}>
                          {page.amount_usd ? `$${page.amount_usd.toFixed(2)}` : "Open amount"}
                          {page.amount_usd && page.amount_locked && (
                            <Lock className="w-3 h-3 inline ml-0.5" />
                          )}
                        </span>
                        <span>•</span>
                        <span data-testid={`text-checkout-payments-${page.checkout_page_id}`}>
                          {page.payment_count} payment{page.payment_count !== 1 ? "s" : ""}
                        </span>
                        <span>•</span>
                        <span data-testid={`text-checkout-earned-${page.checkout_page_id}`}>
                          ${page.total_received_usd.toFixed(2)} earned
                        </span>
                        <span>•</span>
                        <span>{new Date(page.created_at).toLocaleDateString()}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => copyToClipboard(fullUrl, page.checkout_page_id)}
                        className="gap-1 text-xs"
                        data-testid={`button-copy-url-${page.checkout_page_id}`}
                      >
                        {copiedId === page.checkout_page_id ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                        {copiedId === page.checkout_page_id ? "Copied" : "Copy URL"}
                      </Button>
                      <a
                        href={page.checkout_url}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <Button variant="ghost" size="sm" className="gap-1 text-xs" data-testid={`button-view-${page.checkout_page_id}`}>
                          <ExternalLink className="w-3.5 h-3.5" />
                          View
                        </Button>
                      </a>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
