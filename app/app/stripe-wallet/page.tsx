"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Loader2, Wallet, Plus, ArrowUpRight, ArrowDownLeft, Shield, Snowflake, Play, Copy, Settings2, CheckCircle2, Clock, XCircle, DollarSign } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/lib/auth/auth-context";
import { authFetch } from "@/lib/auth-fetch";
import { useToast } from "@/hooks/use-toast";

interface WalletInfo {
  id: number;
  bot_id: string;
  bot_name: string;
  address: string;
  balance_usdc: number;
  balance_display: string;
  status: string;
  guardrails: {
    max_per_tx_usdc: number;
    daily_budget_usdc: number;
    monthly_budget_usdc: number;
    require_approval_above: number | null;
  } | null;
  created_at: string;
}

interface TransactionInfo {
  id: number;
  type: string;
  amount_usdc: number;
  amount_display: string;
  recipient_address: string | null;
  resource_url: string | null;
  tx_hash: string | null;
  status: string;
  created_at: string;
}

interface ApprovalInfo {
  id: number;
  wallet_id: number;
  amount_usdc: number;
  amount_display: string;
  resource_url: string;
  status: string;
  expires_at: string;
  created_at: string;
}

interface BotInfo {
  bot_id: string;
  bot_name: string;
}

export default function StripeWalletPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [wallets, setWallets] = useState<WalletInfo[]>([]);
  const [transactions, setTransactions] = useState<TransactionInfo[]>([]);
  const [approvals, setApprovals] = useState<ApprovalInfo[]>([]);
  const [bots, setBots] = useState<BotInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedWallet, setSelectedWallet] = useState<WalletInfo | null>(null);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [guardrailsDialogOpen, setGuardrailsDialogOpen] = useState(false);
  const [selectedBotId, setSelectedBotId] = useState("");
  const [creating, setCreating] = useState(false);
  const [activeTab, setActiveTab] = useState("wallets");

  const [onrampDialogOpen, setOnrampDialogOpen] = useState(false);
  const [onrampWallet, setOnrampWallet] = useState<WalletInfo | null>(null);
  const [onrampLoading, setOnrampLoading] = useState(false);
  const onrampMountRef = useRef<HTMLDivElement>(null);
  const onrampSessionRef = useRef<any>(null);

  const [guardrailForm, setGuardrailForm] = useState({
    max_per_tx_usdc: 100,
    daily_budget_usdc: 1000,
    monthly_budget_usdc: 10000,
    require_approval_above: null as number | null,
  });
  const [savingGuardrails, setSavingGuardrails] = useState(false);

  const fetchWallets = useCallback(async () => {
    try {
      const res = await authFetch("/api/v1/stripe-wallet/list");
      if (res.ok) {
        const data = await res.json();
        setWallets(data.wallets || []);
        if (data.wallets?.length > 0 && !selectedWallet) {
          setSelectedWallet(data.wallets[0]);
        }
      }
    } catch {} finally {
      setLoading(false);
    }
  }, [selectedWallet]);

  const fetchBots = useCallback(async () => {
    try {
      const res = await authFetch("/api/v1/bots/mine");
      if (res.ok) {
        const data = await res.json();
        setBots(data.bots || []);
      }
    } catch {}
  }, []);

  const fetchTransactions = useCallback(async (walletId: number) => {
    try {
      const res = await authFetch(`/api/v1/stripe-wallet/transactions?wallet_id=${walletId}`);
      if (res.ok) {
        const data = await res.json();
        setTransactions(data.transactions || []);
      }
    } catch {}
  }, []);

  const fetchApprovals = useCallback(async () => {
    try {
      const res = await authFetch("/api/v1/stripe-wallet/approvals");
      if (res.ok) {
        const data = await res.json();
        setApprovals(data.approvals || []);
      }
    } catch {}
  }, []);

  useEffect(() => {
    if (user) {
      fetchWallets();
      fetchBots();
      fetchApprovals();
    } else {
      setLoading(false);
    }
  }, [user, fetchWallets, fetchBots, fetchApprovals]);

  useEffect(() => {
    if (selectedWallet) {
      fetchTransactions(selectedWallet.id);
    }
  }, [selectedWallet, fetchTransactions]);

  async function handleCreate() {
    if (!selectedBotId) return;
    setCreating(true);
    try {
      const res = await authFetch("/api/v1/stripe-wallet/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bot_id: selectedBotId }),
      });
      if (res.ok) {
        toast({ title: "Wallet created", description: "Privy server wallet provisioned on Base." });
        setCreateDialogOpen(false);
        setSelectedBotId("");
        fetchWallets();
      } else {
        const err = await res.json();
        toast({ title: "Error", description: err.error || "Failed to create wallet", variant: "destructive" });
      }
    } catch {
      toast({ title: "Error", description: "Something went wrong", variant: "destructive" });
    } finally {
      setCreating(false);
    }
  }

  async function handleFreeze(wallet: WalletInfo) {
    const freeze = wallet.status === "active";
    try {
      const res = await authFetch("/api/v1/stripe-wallet/freeze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ wallet_id: wallet.id, frozen: freeze }),
      });
      if (res.ok) {
        toast({ title: freeze ? "Wallet paused" : "Wallet activated" });
        fetchWallets();
      }
    } catch {
      toast({ title: "Error", variant: "destructive" });
    }
  }

  async function handleSaveGuardrails() {
    if (!selectedWallet) return;
    setSavingGuardrails(true);
    try {
      const res = await authFetch("/api/v1/stripe-wallet/guardrails", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          wallet_id: selectedWallet.id,
          ...guardrailForm,
        }),
      });
      if (res.ok) {
        toast({ title: "Guardrails updated" });
        setGuardrailsDialogOpen(false);
        fetchWallets();
      }
    } catch {
      toast({ title: "Error", variant: "destructive" });
    } finally {
      setSavingGuardrails(false);
    }
  }

  async function handleApprovalDecision(approvalId: number, decision: "approve" | "reject") {
    try {
      const res = await authFetch("/api/v1/stripe-wallet/approvals/decide", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ approval_id: approvalId, decision }),
      });
      if (res.ok) {
        toast({ title: decision === "approve" ? "Approved" : "Rejected" });
        fetchApprovals();
      }
    } catch {
      toast({ title: "Error", variant: "destructive" });
    }
  }

  function copyAddress(address: string) {
    navigator.clipboard.writeText(address);
    toast({ title: "Copied", description: "Wallet address copied." });
  }

  function loadScript(src: string): Promise<void> {
    return new Promise((resolve, reject) => {
      if (document.querySelector(`script[src="${src}"]`)) {
        resolve();
        return;
      }
      const script = document.createElement("script");
      script.src = src;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error(`Failed to load ${src}`));
      document.head.appendChild(script);
    });
  }

  async function handleOpenOnramp(wallet: WalletInfo) {
    setOnrampWallet(wallet);
    setOnrampLoading(true);

    try {
      const res = await authFetch("/api/v1/stripe-wallet/onramp/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ wallet_id: wallet.id }),
      });

      if (!res.ok) {
        const err = await res.json();
        toast({ title: "Error", description: err.error || "Failed to create onramp session", variant: "destructive" });
        setOnrampLoading(false);
        return;
      }

      const data = await res.json();
      const publishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;

      if (publishableKey) {
        setOnrampDialogOpen(true);

        try {
          await loadScript("https://js.stripe.com/clover/stripe.js");
          await loadScript("https://crypto-js.stripe.com/crypto-onramp-outer.js");

          const StripeOnramp = (window as any).StripeOnramp;
          if (!StripeOnramp) throw new Error("SDK not loaded");

          const stripeOnramp = StripeOnramp(publishableKey);
          const session = stripeOnramp.createSession({
            clientSecret: data.client_secret,
          });

          onrampSessionRef.current = session;

          session.addEventListener("onramp_session_updated", (e: any) => {
            const status = e?.payload?.session?.status;
            if (status === "fulfillment_complete") {
              toast({ title: "Funding complete!", description: "USDC has been delivered to your wallet." });
              fetchWallets();
            }
          });

          setTimeout(() => {
            if (onrampMountRef.current) {
              session.mount(onrampMountRef.current);
            }
            setOnrampLoading(false);
          }, 100);
        } catch (embeddedErr) {
          console.error("Embedded onramp failed, falling back to hosted:", embeddedErr);
          setOnrampDialogOpen(false);
          if (data.redirect_url) {
            window.open(data.redirect_url, "_blank");
            toast({ title: "Opening Stripe", description: "Stripe onramp opened in a new tab." });
          } else {
            toast({ title: "Error", description: "Failed to load onramp widget", variant: "destructive" });
          }
          setOnrampLoading(false);
        }
      } else if (data.redirect_url) {
        window.open(data.redirect_url, "_blank");
        toast({ title: "Opening Stripe", description: "Stripe onramp opened in a new tab." });
        setOnrampLoading(false);
      } else {
        toast({ title: "Configuration needed", description: "Stripe publishable key is required for embedded onramp, and no hosted redirect is available.", variant: "destructive" });
        setOnrampLoading(false);
      }
    } catch (err) {
      console.error("Onramp error:", err);
      toast({ title: "Error", description: "Failed to initialize onramp", variant: "destructive" });
      setOnrampLoading(false);
    }
  }

  function handleCloseOnramp() {
    if (onrampSessionRef.current) {
      try {
        onrampSessionRef.current.destroy?.();
      } catch {}
      onrampSessionRef.current = null;
    }
    setOnrampDialogOpen(false);
    setOnrampWallet(null);
    setOnrampLoading(false);
  }

  function openGuardrailsDialog(wallet: WalletInfo) {
    setSelectedWallet(wallet);
    if (wallet.guardrails) {
      setGuardrailForm({
        max_per_tx_usdc: wallet.guardrails.max_per_tx_usdc,
        daily_budget_usdc: wallet.guardrails.daily_budget_usdc,
        monthly_budget_usdc: wallet.guardrails.monthly_budget_usdc,
        require_approval_above: wallet.guardrails.require_approval_above,
      });
    }
    setGuardrailsDialogOpen(true);
  }

  const statusIcon = (status: string) => {
    switch (status) {
      case "confirmed": return <CheckCircle2 className="w-4 h-4 text-emerald-500" />;
      case "pending": return <Clock className="w-4 h-4 text-amber-500" />;
      case "failed": return <XCircle className="w-4 h-4 text-red-500" />;
      default: return <Clock className="w-4 h-4 text-neutral-400" />;
    }
  };

  return (
    <div className="flex flex-col gap-8 animate-fade-in-up">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900 mb-1" data-testid="text-stripe-wallet-title">Stripe Wallet</h1>
          <p className="text-neutral-500">
            Fund bots with USDC on Base via Stripe. Bots pay for API resources using the x402 protocol.
          </p>
        </div>
        <Button
          onClick={() => setCreateDialogOpen(true)}
          className="rounded-full bg-primary hover:bg-primary/90 gap-2"
          data-testid="button-create-stripe-wallet"
        >
          <Plus className="w-4 h-4" />
          New Wallet
        </Button>
      </div>

      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-2xl border border-blue-100 p-6" data-testid="card-rail1-explainer">
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center flex-shrink-0">
            <Wallet className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <h3 className="font-bold text-neutral-900 mb-1">How Stripe Wallet Works</h3>
            <p className="text-sm text-neutral-600 leading-relaxed">
              Each bot gets a Privy server wallet on Base chain. You fund it with USDC via Stripe's Crypto Onramp (fiat → USDC).
              When your bot needs to pay for an API resource, it uses the x402 payment protocol — CreditClaw signs the EIP-712
              transfer authorization within guardrails you set (per-tx limits, daily/monthly budgets, domain allow/blocklists).
            </p>
          </div>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-3 max-w-md">
          <TabsTrigger value="wallets" data-testid="tab-wallets">Wallets</TabsTrigger>
          <TabsTrigger value="activity" data-testid="tab-activity">Activity</TabsTrigger>
          <TabsTrigger value="approvals" data-testid="tab-approvals">
            Approvals
            {approvals.length > 0 && (
              <span className="ml-2 bg-amber-100 text-amber-700 text-xs px-1.5 py-0.5 rounded-full font-bold">
                {approvals.length}
              </span>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="wallets" className="mt-6">
          {loading ? (
            <div className="flex items-center justify-center py-24" data-testid="loading-stripe-wallets">
              <Loader2 className="w-8 h-8 animate-spin text-neutral-400" />
            </div>
          ) : wallets.length === 0 ? (
            <div className="text-center py-24" data-testid="text-no-stripe-wallets">
              <Wallet className="w-12 h-12 text-neutral-300 mx-auto mb-4" />
              <p className="text-lg text-neutral-400 font-medium">No Stripe Wallets yet.</p>
              <p className="text-sm text-neutral-400 mt-2">Click "New Wallet" to provision a USDC wallet for your bot.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {wallets.map((wallet) => (
                <div className="flex flex-col gap-4 min-w-[320px]" key={wallet.id} data-testid={`card-stripe-wallet-${wallet.id}`}>
                  <div className="bg-gradient-to-br from-blue-600 via-indigo-600 to-purple-700 rounded-2xl p-6 text-white shadow-lg relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -translate-y-8 translate-x-8" />
                    <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/5 rounded-full translate-y-6 -translate-x-6" />

                    <div className="flex items-center justify-between mb-5 relative z-10">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center backdrop-blur-sm">
                          <Wallet className="w-5 h-5 text-white" />
                        </div>
                        <div>
                          <p className="font-semibold text-white" data-testid={`text-bot-name-${wallet.id}`}>{wallet.bot_name}</p>
                          <button
                            onClick={() => copyAddress(wallet.address)}
                            className="text-xs text-white/60 hover:text-white/90 flex items-center gap-1 cursor-pointer transition-colors"
                            data-testid={`button-copy-address-${wallet.id}`}
                          >
                            {wallet.address.slice(0, 6)}...{wallet.address.slice(-4)}
                            <Copy className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                      <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                        wallet.status === "active" ? "bg-emerald-400/20 text-emerald-200 border border-emerald-400/30" :
                        wallet.status === "paused" ? "bg-blue-400/20 text-blue-200 border border-blue-400/30" :
                        "bg-white/10 text-white/70 border border-white/20"
                      }`} data-testid={`badge-status-${wallet.id}`}>
                        {wallet.status}
                      </span>
                    </div>

                    <div className="mb-5 relative z-10">
                      <p className="text-4xl font-bold text-white tracking-tight" data-testid={`text-balance-${wallet.id}`}>
                        {wallet.balance_display}
                      </p>
                      <p className="text-xs text-white/50 mt-1 font-medium tracking-wide uppercase">USDC on Base</p>
                    </div>

                    {wallet.guardrails && (
                      <div className="bg-white/10 backdrop-blur-sm rounded-xl p-3 text-xs text-white/70 space-y-1.5 relative z-10 border border-white/10">
                        <div className="flex justify-between">
                          <span>Per-tx limit</span>
                          <span className="font-medium text-white/90">${wallet.guardrails.max_per_tx_usdc}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Daily budget</span>
                          <span className="font-medium text-white/90">${wallet.guardrails.daily_budget_usdc}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Monthly budget</span>
                          <span className="font-medium text-white/90">${wallet.guardrails.monthly_budget_usdc}</span>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="bg-white rounded-xl border border-neutral-100 p-2 flex justify-between">
                    <Button
                      variant="ghost"
                      className="flex-1 text-xs gap-2 text-emerald-600 font-semibold cursor-pointer hover:bg-emerald-50 rounded-lg transition-colors"
                      onClick={() => handleOpenOnramp(wallet)}
                      data-testid={`button-fund-${wallet.id}`}
                    >
                      <DollarSign className="w-4 h-4" /> Fund with Stripe
                    </Button>
                    <div className="w-px bg-neutral-100 my-1" />
                    <Button
                      variant="ghost"
                      className="flex-1 text-xs gap-2 text-neutral-600 cursor-pointer hover:bg-neutral-100 rounded-lg transition-colors"
                      onClick={() => handleFreeze(wallet)}
                      data-testid={`button-freeze-${wallet.id}`}
                    >
                      {wallet.status === "active" ? (
                        <><Snowflake className="w-4 h-4" /> Pause</>
                      ) : (
                        <><Play className="w-4 h-4" /> Activate</>
                      )}
                    </Button>
                    <div className="w-px bg-neutral-100 my-1" />
                    <Button
                      variant="ghost"
                      className="flex-1 text-xs gap-2 text-neutral-600 cursor-pointer hover:bg-neutral-100 rounded-lg transition-colors"
                      onClick={() => openGuardrailsDialog(wallet)}
                      data-testid={`button-guardrails-${wallet.id}`}
                    >
                      <Settings2 className="w-4 h-4" /> Guardrails
                    </Button>
                    <div className="w-px bg-neutral-100 my-1" />
                    <Button
                      variant="ghost"
                      className="flex-1 text-xs gap-2 text-neutral-600 cursor-pointer hover:bg-neutral-100 rounded-lg transition-colors"
                      onClick={() => { setSelectedWallet(wallet); setActiveTab("activity"); }}
                      data-testid={`button-activity-${wallet.id}`}
                    >
                      <ArrowUpRight className="w-4 h-4" /> Activity
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="activity" className="mt-6">
          {selectedWallet && (
            <div className="mb-4 flex items-center gap-3">
              <select
                className="border rounded-lg px-3 py-2 text-sm bg-white"
                value={selectedWallet.id}
                onChange={(e) => {
                  const w = wallets.find(w => w.id === Number(e.target.value));
                  if (w) setSelectedWallet(w);
                }}
                data-testid="select-wallet-activity"
              >
                {wallets.map(w => (
                  <option key={w.id} value={w.id}>{w.bot_name}</option>
                ))}
              </select>
            </div>
          )}
          {transactions.length === 0 ? (
            <div className="text-center py-16" data-testid="text-no-transactions">
              <ArrowUpRight className="w-10 h-10 text-neutral-300 mx-auto mb-3" />
              <p className="text-neutral-400">No transactions yet</p>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-neutral-100 overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-neutral-50 text-neutral-500 text-xs uppercase tracking-wider">
                  <tr>
                    <th className="text-left px-6 py-3">Type</th>
                    <th className="text-left px-6 py-3">Amount</th>
                    <th className="text-left px-6 py-3">Resource</th>
                    <th className="text-left px-6 py-3">Status</th>
                    <th className="text-left px-6 py-3">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-50">
                  {transactions.map((tx) => (
                    <tr key={tx.id} className="hover:bg-neutral-50/50" data-testid={`row-tx-${tx.id}`}>
                      <td className="px-6 py-4 flex items-center gap-2">
                        {tx.type === "deposit" ? (
                          <ArrowDownLeft className="w-4 h-4 text-emerald-500" />
                        ) : (
                          <ArrowUpRight className="w-4 h-4 text-blue-500" />
                        )}
                        <span className="font-medium capitalize">{tx.type.replace("_", " ")}</span>
                      </td>
                      <td className="px-6 py-4 font-semibold">{tx.amount_display}</td>
                      <td className="px-6 py-4 text-neutral-500 truncate max-w-[200px]">{tx.resource_url || "—"}</td>
                      <td className="px-6 py-4 flex items-center gap-1.5">
                        {statusIcon(tx.status)}
                        <span className="capitalize">{tx.status}</span>
                      </td>
                      <td className="px-6 py-4 text-neutral-500">{new Date(tx.created_at).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </TabsContent>

        <TabsContent value="approvals" className="mt-6">
          {approvals.length === 0 ? (
            <div className="text-center py-16" data-testid="text-no-approvals">
              <Shield className="w-10 h-10 text-neutral-300 mx-auto mb-3" />
              <p className="text-neutral-400">No pending approvals</p>
            </div>
          ) : (
            <div className="space-y-4">
              {approvals.map((a) => (
                <div
                  key={a.id}
                  className="bg-white rounded-2xl border border-amber-100 p-5 flex items-center justify-between"
                  data-testid={`card-approval-${a.id}`}
                >
                  <div>
                    <p className="font-semibold text-neutral-900">{a.amount_display}</p>
                    <p className="text-sm text-neutral-500 truncate max-w-[300px]">{a.resource_url}</p>
                    <p className="text-xs text-amber-600 mt-1">
                      Expires {new Date(a.expires_at).toLocaleTimeString()}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-red-600 border-red-200 hover:bg-red-50"
                      onClick={() => handleApprovalDecision(a.id, "reject")}
                      data-testid={`button-reject-${a.id}`}
                    >
                      Reject
                    </Button>
                    <Button
                      size="sm"
                      className="bg-emerald-600 hover:bg-emerald-700"
                      onClick={() => handleApprovalDecision(a.id, "approve")}
                      data-testid={`button-approve-${a.id}`}
                    >
                      Approve
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogTitle>Create Stripe Wallet</DialogTitle>
          <DialogDescription>
            Provision a Privy server wallet on Base for your bot. It can be funded with USDC via Stripe.
          </DialogDescription>
          <div className="space-y-4 mt-4">
            <div>
              <Label>Select Bot</Label>
              <select
                className="w-full mt-1.5 border rounded-lg px-3 py-2 text-sm bg-white"
                value={selectedBotId}
                onChange={(e) => setSelectedBotId(e.target.value)}
                data-testid="select-bot-create"
              >
                <option value="">Choose a bot...</option>
                {bots.map((bot) => (
                  <option key={bot.bot_id} value={bot.bot_id}>{bot.bot_name}</option>
                ))}
              </select>
            </div>
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setCreateDialogOpen(false)} data-testid="button-cancel-create">
                Cancel
              </Button>
              <Button
                onClick={handleCreate}
                disabled={!selectedBotId || creating}
                className="bg-primary hover:bg-primary/90"
                data-testid="button-confirm-create"
              >
                {creating && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                Create Wallet
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={guardrailsDialogOpen} onOpenChange={setGuardrailsDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogTitle>Spending Guardrails</DialogTitle>
          <DialogDescription>
            Set limits to control how your bot spends USDC via x402.
          </DialogDescription>
          <div className="space-y-4 mt-4">
            <div>
              <Label>Max per transaction (USD)</Label>
              <Input
                type="number"
                value={guardrailForm.max_per_tx_usdc}
                onChange={(e) => setGuardrailForm(prev => ({ ...prev, max_per_tx_usdc: Number(e.target.value) }))}
                data-testid="input-max-per-tx"
              />
            </div>
            <div>
              <Label>Daily budget (USD)</Label>
              <Input
                type="number"
                value={guardrailForm.daily_budget_usdc}
                onChange={(e) => setGuardrailForm(prev => ({ ...prev, daily_budget_usdc: Number(e.target.value) }))}
                data-testid="input-daily-budget"
              />
            </div>
            <div>
              <Label>Monthly budget (USD)</Label>
              <Input
                type="number"
                value={guardrailForm.monthly_budget_usdc}
                onChange={(e) => setGuardrailForm(prev => ({ ...prev, monthly_budget_usdc: Number(e.target.value) }))}
                data-testid="input-monthly-budget"
              />
            </div>
            <div>
              <Label>Require approval above (USD, optional)</Label>
              <Input
                type="number"
                value={guardrailForm.require_approval_above ?? ""}
                onChange={(e) => setGuardrailForm(prev => ({ ...prev, require_approval_above: e.target.value ? Number(e.target.value) : null }))}
                placeholder="No threshold"
                data-testid="input-approval-threshold"
              />
            </div>
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setGuardrailsDialogOpen(false)} data-testid="button-cancel-guardrails">
                Cancel
              </Button>
              <Button
                onClick={handleSaveGuardrails}
                disabled={savingGuardrails}
                className="bg-primary hover:bg-primary/90"
                data-testid="button-save-guardrails"
              >
                {savingGuardrails && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                Save
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={onrampDialogOpen} onOpenChange={(open) => { if (!open) handleCloseOnramp(); }}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto" data-testid="dialog-onramp">
          <DialogTitle className="flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-emerald-600" />
            Fund Wallet {onrampWallet ? `— ${onrampWallet.bot_name}` : ""}
          </DialogTitle>
          <DialogDescription>
            Buy USDC with your credit card via Stripe. Funds will be delivered directly to your wallet on Base.
          </DialogDescription>
          <div className="mt-4 min-h-[500px] relative">
            {onrampLoading && (
              <div className="absolute inset-0 flex items-center justify-center bg-white/80 z-10">
                <div className="flex flex-col items-center gap-3">
                  <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
                  <p className="text-sm text-neutral-500">Loading Stripe onramp...</p>
                </div>
              </div>
            )}
            <div ref={onrampMountRef} id="stripe-onramp-element" className="w-full min-h-[480px]" data-testid="container-onramp-widget" />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
