"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Loader2, Wallet, Plus, ArrowUpRight, ArrowDownLeft, Shield, Copy, CheckCircle2, Clock, XCircle, DollarSign, ArrowLeftRight, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Sheet, SheetContent, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/lib/auth/auth-context";
import { authFetch } from "@/lib/auth-fetch";
import { useToast } from "@/hooks/use-toast";
import type { Rail1WalletInfo, Rail1ApprovalInfo, Rail1TransactionInfo } from "@/components/wallet/types";
import { useWalletActions } from "@/components/wallet/hooks/use-wallet-actions";
import { useBotLinking } from "@/components/wallet/hooks/use-bot-linking";
import { useTransfer } from "@/components/wallet/hooks/use-transfer";
import { useGuardrails } from "@/components/wallet/hooks/use-guardrails";
import { CryptoWalletItem } from "@/components/wallet/crypto-wallet-item";
import { GuardrailDialog } from "@/components/wallet/dialogs/guardrail-dialog";
import { LinkBotDialog } from "@/components/wallet/dialogs/link-bot-dialog";
import { UnlinkBotDialog } from "@/components/wallet/dialogs/unlink-bot-dialog";
import { TransferDialog } from "@/components/wallet/dialogs/transfer-dialog";
import { CreateCryptoWalletDialog } from "@/components/wallet/dialogs/create-crypto-wallet-dialog";
import type { CryptoGuardrailForm } from "@/components/wallet/dialogs/guardrail-dialog";

export default function StripeWalletPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [wallets, setWallets] = useState<Rail1WalletInfo[]>([]);
  const [transactions, setTransactions] = useState<Rail1TransactionInfo[]>([]);
  const [approvals, setApprovals] = useState<Rail1ApprovalInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedWallet, setSelectedWallet] = useState<Rail1WalletInfo | null>(null);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("wallets");

  const [onrampDialogOpen, setOnrampDialogOpen] = useState(false);
  const [onrampWallet, setOnrampWallet] = useState<Rail1WalletInfo | null>(null);
  const [onrampLoading, setOnrampLoading] = useState(false);
  const [showCloseConfirm, setShowCloseConfirm] = useState(false);
  const onrampMountRef = useRef<HTMLDivElement>(null);
  const onrampSessionRef = useRef<any>(null);

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

  const walletActions = useWalletActions({
    railPrefix: "stripe-wallet",
    entityType: "wallet",
    entityIdField: "wallet_id",
    onUpdate: fetchWallets,
    onTransactionsRefresh: (entityId) => {
      if (selectedWallet?.id === entityId) {
        fetchTransactions(entityId as number);
      }
    },
  });

  const botLinking = useBotLinking({
    railPrefix: "stripe-wallet",
    entityType: "wallet",
    onUpdate: fetchWallets,
  });

  const transfer = useTransfer({
    sourceRail: "privy",
    onUpdate: fetchWallets,
    onTransactionsRefresh: () => {
      if (selectedWallet) {
        fetchTransactions(selectedWallet.id);
      }
    },
  });

  const guardrails = useGuardrails<Rail1WalletInfo>({
    variant: "crypto",
    railPrefix: "stripe-wallet",
    onUpdate: fetchWallets,
  });

  useEffect(() => {
    if (user) {
      fetchWallets();
      botLinking.fetchBots();
      fetchApprovals();
    } else {
      setLoading(false);
    }
  }, [user, fetchWallets, botLinking.fetchBots, fetchApprovals]);

  useEffect(() => {
    if (selectedWallet) {
      fetchTransactions(selectedWallet.id);
    }
  }, [selectedWallet, fetchTransactions]);

  const statusIcon = (status: string) => {
    switch (status) {
      case "confirmed": return <CheckCircle2 className="w-4 h-4 text-emerald-500" />;
      case "pending": return <Clock className="w-4 h-4 text-amber-500" />;
      case "failed": return <XCircle className="w-4 h-4 text-red-500" />;
      default: return <Clock className="w-4 h-4 text-neutral-400" />;
    }
  };

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

  async function handleOpenOnramp(wallet: Rail1WalletInfo) {
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

      const isInIframe = window.self !== window.top;
      console.log("[Onramp] Session ready:", { sessionId: data.session_id, hasClientSecret: !!data.client_secret, hasRedirectUrl: !!data.redirect_url, isInIframe });

      if (publishableKey && !isInIframe) {
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

          session.addEventListener("onramp_ui_loaded", () => {
            console.log("[Onramp] Widget UI loaded successfully");
          });

          session.addEventListener("onramp_session_updated", (e: any) => {
            const status = e?.payload?.session?.status;
            console.log("[Onramp] Session status:", status);
            if (status === "fulfillment_complete") {
              toast({ title: "Funding complete!", description: "USDC has been delivered to your wallet." });
              fetchWallets();
            }
          });

          setTimeout(() => {
            if (onrampMountRef.current) {
              session.mount(onrampMountRef.current);
            } else {
              console.error("[Onramp] Mount ref is null");
            }
            setOnrampLoading(false);
          }, 100);
        } catch (embeddedErr) {
          console.error("[Onramp] Embedded widget failed:", embeddedErr);
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
                <CryptoWalletItem
                  key={wallet.id}
                  wallet={wallet}
                  color="blue"
                  onFund={() => handleOpenOnramp(wallet)}
                  onFreeze={() => walletActions.handleFreeze({ id: wallet.id, name: wallet.bot_name || "Wallet", status: wallet.status })}
                  onGuardrails={() => guardrails.openDialog(wallet)}
                  onActivity={() => { setSelectedWallet(wallet); setActiveTab("activity"); }}
                  onAddAgent={() => botLinking.openLinkDialog({ id: wallet.id, name: wallet.bot_name || "Wallet", bot_id: wallet.bot_id || null, bot_name: wallet.bot_name || null })}
                  onUnlinkBot={() => botLinking.openUnlinkDialog({ id: wallet.id, name: wallet.bot_name || "Wallet", bot_id: wallet.bot_id, bot_name: wallet.bot_name })}
                  onCopyAddress={() => walletActions.copyAddress(wallet.address)}
                  onSyncBalance={() => walletActions.handleSyncAndPatch(wallet.id, setWallets)}
                  onTransfer={() => transfer.openTransferDialog(wallet)}
                  syncingBalance={walletActions.syncingId === wallet.id}
                  fundLabel="Fund with Stripe"
                  testIdPrefix="stripe"
                  basescanUrl={`https://basescan.org/address/${wallet.address}#tokentxns`}
                />
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
                    <th className="text-left px-6 py-3">Balance</th>
                    <th className="text-left px-6 py-3">Resource</th>
                    <th className="text-left px-6 py-3">Status</th>
                    <th className="text-left px-6 py-3">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-50">
                  {transactions.map((tx) => (
                    <tr key={tx.id} className="hover:bg-neutral-50/50" data-testid={`row-tx-${tx.id}`}>
                      <td className="px-6 py-4 flex items-center gap-2">
                        {tx.type === "transfer" ? (
                          tx.metadata?.direction === "inbound" ? (
                            <ArrowDownLeft className="w-4 h-4 text-emerald-500" />
                          ) : (
                            <ArrowUpRight className="w-4 h-4 text-red-500" />
                          )
                        ) : tx.type === "deposit" ? (
                          <ArrowDownLeft className="w-4 h-4 text-emerald-500" />
                        ) : tx.type === "reconciliation" ? (
                          <ArrowLeftRight className="w-4 h-4 text-amber-500" />
                        ) : (
                          <ArrowUpRight className="w-4 h-4 text-blue-500" />
                        )}
                        <span className="font-medium capitalize">
                          {tx.type === "transfer"
                            ? tx.metadata?.direction === "inbound" ? "Transfer in" : "Transfer out"
                            : tx.type.replace("_", " ")}
                        </span>
                      </td>
                      <td className={`px-6 py-4 font-semibold ${tx.type === "transfer" ? (tx.metadata?.direction === "inbound" ? "text-emerald-600" : "text-red-600") : ""}`}>
                        {tx.type === "transfer" ? (tx.metadata?.direction === "inbound" ? "+" : "−") : ""}{tx.amount_display}
                      </td>
                      <td className="px-6 py-4 text-neutral-500" data-testid={`text-balance-after-${tx.id}`}>{tx.balance_after_display || "—"}</td>
                      <td className="px-6 py-4 text-neutral-500 truncate max-w-[200px]">
                        {tx.type === "transfer" && tx.metadata?.counterparty_address
                          ? `${tx.metadata.counterparty_address.slice(0, 6)}...${tx.metadata.counterparty_address.slice(-4)}`
                          : tx.resource_url || "—"}
                      </td>
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
                      onClick={() => walletActions.handleApprovalDecision(a.id, "reject", { onSuccess: fetchApprovals })}
                      data-testid={`button-reject-${a.id}`}
                    >
                      Reject
                    </Button>
                    <Button
                      size="sm"
                      className="bg-emerald-600 hover:bg-emerald-700"
                      onClick={() => walletActions.handleApprovalDecision(a.id, "approve", { onSuccess: fetchApprovals })}
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

      <CreateCryptoWalletDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        bots={botLinking.bots}
        config={{
          title: "Create Stripe Wallet",
          description: "Provision a Privy server wallet on Base for your bot. It can be funded with USDC via Stripe.",
          endpoint: "/api/v1/stripe-wallet/create",
          buttonLabel: "Create Wallet",
          successMessage: "Wallet created",
          successDescription: "Privy server wallet provisioned on Base.",
        }}
        onCreated={fetchWallets}
      />

      <GuardrailDialog
        open={guardrails.guardrailsDialogOpen}
        onOpenChange={guardrails.setGuardrailsDialogOpen}
        form={guardrails.form}
        onFormChange={(f) => guardrails.setForm(f as CryptoGuardrailForm)}
        saving={guardrails.saving}
        onSave={guardrails.save}
        variant="crypto"
      />

      <Sheet open={onrampDialogOpen} onOpenChange={(open) => { if (!open) setShowCloseConfirm(true); }}>
        <SheetContent
          side="right"
          size="lg"
          overlayTitle={onrampWallet && onrampWallet.bot_name && onrampWallet.bot_name !== "Unknown Bot" ? `Fund Wallet "${onrampWallet.bot_name}" via Stripe/Link` : "Fund Wallet via Stripe/Link"}
          overlayDescription={"Transfer to your USDC wallet.\nUse a credit card or bank connection via Stripe."}
          overlayExtra={onrampWallet ? (
            <div className="mt-6 space-y-4 max-w-xs mx-auto">
              <div>
                <p className="text-sm text-white/70 font-semibold mb-2">Wallet Address</p>
                <div className="flex items-center gap-2 bg-white/10 rounded-lg px-3 py-2">
                  <code className="text-sm text-white/70 font-mono truncate flex-1" data-testid="text-onramp-wallet-address">
                    {onrampWallet.address}
                  </code>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(onrampWallet.address);
                      toast({ title: "Wallet address copied!" });
                    }}
                    className="text-white/70 hover:text-white transition-colors flex-shrink-0 cursor-pointer"
                    data-testid="button-copy-onramp-address"
                  >
                    <Copy className="w-5 h-5" />
                  </button>
                </div>
                <p className="text-sm text-white/70 mt-2 leading-relaxed">
                  You will need to paste your wallet address when funding for the first time. Copy it from here.
                </p>
              </div>
              <Button
                variant="outline"
                className="w-full border-white/30 text-white/70 hover:bg-white/10 hover:text-white cursor-pointer"
                onClick={() => setShowCloseConfirm(true)}
                data-testid="button-close-stripe-funding"
              >
                Close Stripe Funding
              </Button>
            </div>
          ) : undefined}
          className="overflow-y-auto p-0"
          data-testid="drawer-onramp"
          onInteractOutside={(e) => e.preventDefault()}
          onEscapeKeyDown={(e) => e.preventDefault()}
        >
          <SheetTitle className="sr-only">
            {onrampWallet && onrampWallet.bot_name && onrampWallet.bot_name !== "Unknown Bot" ? `Fund Wallet "${onrampWallet.bot_name}" via Stripe/Link` : "Fund Wallet via Stripe/Link"}
          </SheetTitle>
          <SheetDescription className="sr-only">
            Transfer to your USDC wallet. Use a credit card or bank connection via Stripe.
          </SheetDescription>
          <div className="p-6 md:hidden border-b border-border">
            <div className="flex items-center gap-2 pr-8">
              <DollarSign className="w-5 h-5 text-emerald-600 flex-shrink-0" />
              <h2 className="text-lg font-semibold text-foreground">
                {onrampWallet && onrampWallet.bot_name && onrampWallet.bot_name !== "Unknown Bot" ? `Fund "${onrampWallet.bot_name}"` : "Fund Wallet"}
              </h2>
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              Transfer to your USDC wallet here on CreditClaw.
            </p>
            {onrampWallet && (
              <div className="mt-3">
                <p className="text-xs text-muted-foreground mb-1">Wallet Address</p>
                <div className="flex items-center gap-2 bg-neutral-100 rounded-lg px-3 py-2">
                  <code className="text-xs font-mono truncate flex-1">{onrampWallet.address}</code>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(onrampWallet.address);
                      toast({ title: "Wallet address copied!" });
                    }}
                    className="text-neutral-400 hover:text-neutral-700 transition-colors flex-shrink-0 cursor-pointer"
                  >
                    <Copy className="w-3.5 h-3.5" />
                  </button>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Paste this address when prompted during Stripe funding.
                </p>
              </div>
            )}
          </div>
          <div className="flex-1 relative min-h-[500px]">
            {onrampLoading && (
              <div className="absolute inset-0 flex items-center justify-center bg-background/80 z-10">
                <div className="flex flex-col items-center gap-3">
                  <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
                  <p className="text-sm text-muted-foreground">Loading Stripe onramp...</p>
                </div>
              </div>
            )}
            <div ref={onrampMountRef} id="stripe-onramp-element" className="w-full min-h-[480px] p-4" data-testid="container-onramp-widget" />
          </div>
          <div className="p-4 border-t border-border md:hidden">
            <Button
              variant="outline"
              className="w-full cursor-pointer"
              onClick={() => setShowCloseConfirm(true)}
              data-testid="button-close-stripe-funding-mobile"
            >
              Close Stripe Funding
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      <AlertDialog open={showCloseConfirm} onOpenChange={setShowCloseConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-500" />
              Close Stripe Funding?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to close this Stripe Funding process? You will lose your progress.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-close-funding">Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              onClick={() => {
                setShowCloseConfirm(false);
                handleCloseOnramp();
              }}
              data-testid="button-confirm-close-funding"
            >
              Yes, Close
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <LinkBotDialog
        open={!!botLinking.linkTarget}
        onOpenChange={(open) => { if (!open) botLinking.closeLinkDialog(); }}
        itemName={botLinking.linkTarget?.name || ""}
        bots={botLinking.bots}
        selectedBotId={botLinking.linkBotId}
        onBotIdChange={botLinking.setLinkBotId}
        loading={botLinking.linkLoading}
        onConfirm={botLinking.handleLinkBot}
        onCancel={botLinking.closeLinkDialog}
        itemType="wallet"
      />

      <TransferDialog
        open={transfer.transferDialogOpen}
        onOpenChange={(o) => { if (!o) transfer.closeTransferDialog(); }}
        sourceWallet={transfer.transferSourceWallet}
        amount={transfer.transferAmount}
        onAmountChange={transfer.setTransferAmount}
        destType={transfer.transferDestType}
        onDestTypeChange={transfer.setTransferDestType}
        destWalletKey={transfer.transferDestWalletKey}
        onDestWalletKeyChange={transfer.setTransferDestWalletKey}
        destAddress={transfer.transferDestAddress}
        onDestAddressChange={transfer.setTransferDestAddress}
        availableWallets={transfer.allWalletsForTransfer}
        submitting={transfer.transferSubmitting}
        onSubmit={transfer.handleTransfer}
        onClose={transfer.closeTransferDialog}
      />

      <UnlinkBotDialog
        open={!!botLinking.unlinkTarget}
        onOpenChange={(open) => { if (!open) botLinking.closeUnlinkDialog(); }}
        botName={botLinking.unlinkTarget?.bot_name || ""}
        loading={botLinking.unlinkLoading}
        onConfirm={botLinking.handleUnlinkBot}
        onCancel={botLinking.closeUnlinkDialog}
        itemType="wallet"
      />
    </div>
  );
}
