"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Loader2, ShoppingCart, Plus, CheckCircle2, Clock, XCircle, DollarSign, Package, Truck, ExternalLink, CreditCard, RefreshCw, MapPin, Eye, ArrowDownLeft, ArrowUpRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/lib/auth/auth-context";
import { authFetch } from "@/lib/auth-fetch";
import { useToast } from "@/hooks/use-toast";
import { CrossmintProvider, CrossmintEmbeddedCheckout } from "@crossmint/client-sdk-react-ui";
import type { Rail2WalletInfo, Rail2TransactionInfo, Rail2ApprovalInfo } from "@/components/wallet/types";
import { microUsdcToDisplay } from "@/components/wallet/types";
import { StatusBadge } from "@/components/wallet/status-badge";
import { useWalletActions } from "@/components/wallet/hooks/use-wallet-actions";
import { useBotLinking } from "@/components/wallet/hooks/use-bot-linking";
import { useTransfer } from "@/components/wallet/hooks/use-transfer";
import { useGuardrails } from "@/components/wallet/hooks/use-guardrails";
import { CryptoWalletItem } from "@/components/wallet/crypto-wallet-item";
import { GuardrailDialog } from "@/components/wallet/dialogs/guardrail-dialog";
import { TransferDialog } from "@/components/wallet/dialogs/transfer-dialog";
import { CreateCryptoWalletDialog } from "@/components/wallet/dialogs/create-crypto-wallet-dialog";
import type { CardGuardrailForm } from "@/components/wallet/dialogs/guardrail-dialog";

const ORDER_TIMELINE_STEPS = [
  { key: "pending", label: "Pending", icon: Clock },
  { key: "processing", label: "Processing", icon: Package },
  { key: "shipped", label: "Shipped", icon: Truck },
  { key: "delivered", label: "Delivered", icon: CheckCircle2 },
];

function getTimelineIndex(orderStatus: string | null): number {
  if (!orderStatus) return 0;
  const failed = ["failed", "payment_failed", "delivery_failed"];
  if (failed.includes(orderStatus)) return -1;
  const map: Record<string, number> = { pending: 0, quote: 0, confirmed: 1, processing: 1, shipped: 2, delivered: 3 };
  return map[orderStatus] ?? 0;
}

function OrderTimeline({ orderStatus }: { orderStatus: string | null }) {
  const isFailed = orderStatus && ["failed", "payment_failed", "delivery_failed"].includes(orderStatus);
  const currentIdx = getTimelineIndex(orderStatus);

  if (isFailed) {
    return (
      <div className="flex items-center gap-2 py-3 px-4 bg-red-50 rounded-lg border border-red-200" data-testid="order-timeline-failed">
        <XCircle className="w-5 h-5 text-red-500" />
        <span className="text-sm font-medium text-red-700">{(orderStatus || "").replace(/_/g, " ")}</span>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between py-3" data-testid="order-timeline">
      {ORDER_TIMELINE_STEPS.map((step, idx) => {
        const isCompleted = idx <= currentIdx;
        const isCurrent = idx === currentIdx;
        const Icon = step.icon;
        return (
          <div key={step.key} className="flex flex-col items-center flex-1 relative">
            {idx > 0 && (
              <div className={`absolute top-4 -left-1/2 w-full h-0.5 ${idx <= currentIdx ? "bg-violet-400" : "bg-neutral-200"}`} style={{ zIndex: 0 }} />
            )}
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center relative z-10 ${
                isCurrent ? "bg-violet-600 text-white ring-2 ring-violet-200" :
                isCompleted ? "bg-violet-100 text-violet-600" :
                "bg-neutral-100 text-neutral-400"
              }`}
            >
              <Icon className="w-4 h-4" />
            </div>
            <span className={`text-xs mt-1 ${isCurrent ? "font-semibold text-violet-700" : isCompleted ? "text-violet-600" : "text-neutral-400"}`}>
              {step.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function CrossmintCheckoutWrapper({ orderId, clientSecret, onError, onSuccess }: {
  orderId: string;
  clientSecret: string;
  onError: () => void;
  onSuccess: () => void;
}) {
  const mountTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    mountTimerRef.current = setTimeout(() => {
      if (!mounted) {
        onError();
      }
    }, 15000);

    return () => {
      if (mountTimerRef.current) clearTimeout(mountTimerRef.current);
    };
  }, [mounted, onError]);

  return (
    <div
      className="w-full min-h-[480px]"
      data-testid="container-crossmint-checkout"
      ref={() => setMounted(true)}
    >
      <CrossmintEmbeddedCheckout
        orderId={orderId}
        payment={{
          crypto: { enabled: true },
          fiat: { enabled: true },
        }}
      />
    </div>
  );
}

export default function CardWalletPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [wallets, setWallets] = useState<Rail2WalletInfo[]>([]);
  const [transactions, setTransactions] = useState<Rail2TransactionInfo[]>([]);
  const [approvals, setApprovals] = useState<Rail2ApprovalInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedWallet, setSelectedWallet] = useState<Rail2WalletInfo | null>(null);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("wallets");

  const [fundDialogOpen, setFundDialogOpen] = useState(false);
  const [fundWallet, setFundWallet] = useState<Rail2WalletInfo | null>(null);
  const [fundAmount, setFundAmount] = useState("25");
  const [fundLoading, setFundLoading] = useState(false);
  const [fundOrderData, setFundOrderData] = useState<{ orderId: string; clientSecret: string } | null>(null);
  const [fundEmbedError, setFundEmbedError] = useState(false);

  const [orderDetailOpen, setOrderDetailOpen] = useState(false);
  const [orderDetailTx, setOrderDetailTx] = useState<Rail2TransactionInfo | null>(null);
  const [orderRefreshing, setOrderRefreshing] = useState(false);

  const fetchWallets = useCallback(async () => {
    try {
      const res = await authFetch("/api/v1/card-wallet/list");
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

  const fetchTransactions = useCallback(async () => {
    if (!selectedWallet) return;
    try {
      const res = await authFetch(`/api/v1/card-wallet/transactions?wallet_id=${selectedWallet.id}`);
      if (res.ok) {
        const data = await res.json();
        setTransactions(data.transactions || []);
      }
    } catch {}
  }, [selectedWallet]);

  const fetchApprovals = useCallback(async () => {
    try {
      const res = await authFetch("/api/v1/card-wallet/approvals");
      if (res.ok) {
        const data = await res.json();
        setApprovals(data.approvals || []);
      }
    } catch {}
  }, []);

  const walletActions = useWalletActions({
    railPrefix: "card-wallet",
    entityType: "wallet",
    entityIdField: "wallet_id",
    onUpdate: fetchWallets,
    onTransactionsRefresh: () => fetchTransactions(),
  });

  const botLinking = useBotLinking({
    railPrefix: "card-wallet",
    entityType: "wallet",
    onUpdate: fetchWallets,
  });

  const transfer = useTransfer({
    sourceRail: "crossmint",
    onUpdate: fetchWallets,
    onTransactionsRefresh: fetchTransactions,
  });

  const guardrails = useGuardrails<Rail2WalletInfo>({
    variant: "card",
    railPrefix: "card-wallet",
    procurementScope: "rail2",
    microUsdcMultiplier: true,
    onUpdate: fetchWallets,
  });

  useEffect(() => {
    if (user) {
      fetchWallets();
      botLinking.fetchBots();
      fetchApprovals();
    }
  }, [user, fetchWallets, botLinking.fetchBots, fetchApprovals]);

  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);

  const handleOpenOrderDetail = (tx: Rail2TransactionInfo) => {
    setOrderDetailTx(tx);
    setOrderDetailOpen(true);
  };

  const handleRefreshOrder = async () => {
    if (!orderDetailTx?.crossmint_order_id) return;
    setOrderRefreshing(true);
    try {
      const res = await authFetch(`/api/v1/card-wallet/orders/${orderDetailTx.crossmint_order_id}`);
      if (res.ok) {
        const data = await res.json();
        const updated: Rail2TransactionInfo = {
          ...orderDetailTx,
          order_status: data.order.order_status,
          tracking_info: data.order.tracking_info,
          status: data.order.status,
        };
        setOrderDetailTx(updated);
        setTransactions(prev => prev.map(t => t.id === updated.id ? updated : t));
        toast({ title: "Order status refreshed" });
      }
    } catch {
      toast({ title: "Failed to refresh order status", variant: "destructive" });
    } finally {
      setOrderRefreshing(false);
    }
  };

  const handleOpenFund = async (wallet: Rail2WalletInfo) => {
    setFundWallet(wallet);
    setFundOrderData(null);
    setFundEmbedError(false);
    setFundDialogOpen(true);
  };

  const handleStartFund = async () => {
    if (!fundWallet) return;
    setFundLoading(true);
    setFundEmbedError(false);
    try {
      const res = await authFetch("/api/v1/card-wallet/onramp/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ wallet_id: fundWallet.id, amount_usd: Number(fundAmount) }),
      });
      if (!res.ok) {
        const err = await res.json();
        toast({ title: "Error", description: err.error || "Failed to create funding session", variant: "destructive" });
        setFundLoading(false);
        return;
      }
      const data = await res.json();
      setFundOrderData({ orderId: data.order_id, clientSecret: data.client_secret });
    } catch {
      toast({ title: "Failed to start funding", variant: "destructive" });
    } finally {
      setFundLoading(false);
    }
  };

  const handleCloseFund = () => {
    setFundDialogOpen(false);
    setFundWallet(null);
    setFundOrderData(null);
    setFundEmbedError(false);
    setFundAmount("25");
    fetchWallets();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-neutral-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="card-wallet-page">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">Card Wallet</h1>
          <p className="text-sm text-neutral-500 mt-1">CrossMint-powered wallets for AI agent commerce purchases</p>
        </div>
        <Button onClick={() => setCreateDialogOpen(true)} className="gap-2" data-testid="button-create-card-wallet">
          <Plus className="w-4 h-4" />
          New Card Wallet
        </Button>
      </div>

      {approvals.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4" data-testid="pending-approvals-banner">
          <div className="flex items-center gap-2 mb-3">
            <Clock className="w-5 h-5 text-amber-600" />
            <h3 className="font-semibold text-amber-800">Pending Approvals ({approvals.length})</h3>
          </div>
          <div className="space-y-3">
            {approvals.map((a) => (
              <div key={a.id} className="bg-white rounded-lg border border-amber-100 p-4 flex items-center justify-between" data-testid={`approval-card-${a.id}`}>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <Package className="w-4 h-4 text-neutral-500" />
                    <span className="font-medium text-sm">{a.product_name}</span>
                    <span className="text-xs text-neutral-400">by {a.bot_name}</span>
                  </div>
                  {a.shipping_address && (
                    <p className="text-xs text-neutral-500 mt-1">
                      Ship to: {Object.values(a.shipping_address).filter(Boolean).join(", ")}
                    </p>
                  )}
                  <p className="text-xs text-neutral-400 mt-1">
                    Expires: {new Date(a.expires_at).toLocaleString()}
                  </p>
                </div>
                <div className="flex items-center gap-2 ml-4">
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-red-600 border-red-200 hover:bg-red-50"
                    onClick={() => walletActions.handleApprovalDecision(a.id, "reject", { onSuccess: () => { fetchApprovals(); fetchTransactions(); } })}
                    data-testid={`button-reject-${a.id}`}
                  >
                    <XCircle className="w-4 h-4 mr-1" />
                    Reject
                  </Button>
                  <Button
                    size="sm"
                    className="bg-emerald-600 hover:bg-emerald-700"
                    onClick={() => walletActions.handleApprovalDecision(a.id, "approve", { onSuccess: () => { fetchApprovals(); fetchTransactions(); } })}
                    data-testid={`button-approve-${a.id}`}
                  >
                    <CheckCircle2 className="w-4 h-4 mr-1" />
                    Approve
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="wallets" data-testid="tab-wallets">Wallets</TabsTrigger>
          <TabsTrigger value="orders" data-testid="tab-orders">Orders</TabsTrigger>
        </TabsList>

        <TabsContent value="wallets" className="mt-4">
          {wallets.length === 0 ? (
            <div className="text-center py-16 bg-white rounded-xl border border-neutral-100">
              <ShoppingCart className="w-12 h-12 mx-auto text-neutral-300 mb-4" />
              <h3 className="text-lg font-semibold text-neutral-700">No Card Wallets yet</h3>
              <p className="text-sm text-neutral-500 mt-1 mb-4">Create a wallet to let your AI agents make commerce purchases</p>
              <Button onClick={() => setCreateDialogOpen(true)} className="gap-2" data-testid="button-create-first-wallet">
                <Plus className="w-4 h-4" />
                Create First Wallet
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {wallets.map((wallet) => (
                <CryptoWalletItem
                  key={wallet.id}
                  wallet={wallet}
                  color="purple"
                  onFund={() => handleOpenFund(wallet)}
                  onFreeze={() => walletActions.handleFreeze({ id: wallet.id, name: wallet.bot_name || "Wallet", status: wallet.status })}
                  onGuardrails={() => guardrails.openDialog(wallet)}
                  onActivity={() => { setSelectedWallet(wallet); setActiveTab("orders"); }}
                  onCopyAddress={() => walletActions.copyAddress(wallet.address)}
                  onSyncBalance={() => walletActions.handleSyncAndPatch(wallet.id, setWallets)}
                  onTransfer={() => transfer.openTransferDialog(wallet)}
                  syncingBalance={walletActions.syncingId === wallet.id}
                  fundLabel="Fund"
                  testIdPrefix="crossmint"
                  basescanUrl={`https://basescan.org/address/${wallet.address}`}
                  guardrailValueFormatter={microUsdcToDisplay}
                />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="orders" className="mt-4">
          {selectedWallet && (
            <div className="mb-4 flex items-center gap-2">
              <Label className="text-sm text-neutral-500">Wallet:</Label>
              <select
                value={selectedWallet.id}
                onChange={(e) => {
                  const w = wallets.find(w => w.id === Number(e.target.value));
                  if (w) setSelectedWallet(w);
                }}
                className="border rounded-lg px-3 py-1.5 text-sm"
                data-testid="select-wallet-orders"
              >
                {wallets.map((w) => (
                  <option key={w.id} value={w.id}>{w.bot_name} ({w.address.slice(0, 8)}...)</option>
                ))}
              </select>
            </div>
          )}

          {transactions.length === 0 ? (
            <div className="text-center py-16 bg-white rounded-xl border border-neutral-100">
              <Package className="w-12 h-12 mx-auto text-neutral-300 mb-4" />
              <h3 className="text-lg font-semibold text-neutral-700">No orders yet</h3>
              <p className="text-sm text-neutral-500 mt-1">Orders will appear here when your bots make purchases</p>
            </div>
          ) : (
            <div className="space-y-3">
              {transactions.map((tx) => (
                <div
                  key={tx.id}
                  className="bg-white rounded-xl border border-neutral-100 p-4 cursor-pointer hover:border-violet-200 hover:shadow-sm transition-all"
                  onClick={() => handleOpenOrderDetail(tx)}
                  data-testid={`transaction-card-${tx.id}`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                        tx.type === "transfer"
                          ? (tx.metadata?.direction === "inbound" ? "bg-emerald-50" : "bg-red-50")
                          : tx.type === "purchase" ? "bg-violet-50" : "bg-emerald-50"
                      }`}>
                        {tx.type === "transfer"
                          ? (tx.metadata?.direction === "inbound"
                            ? <ArrowDownLeft className="w-4 h-4 text-emerald-600" />
                            : <ArrowUpRight className="w-4 h-4 text-red-600" />)
                          : tx.type === "purchase" ? <ShoppingCart className="w-4 h-4 text-violet-600" /> : <DollarSign className="w-4 h-4 text-emerald-600" />}
                      </div>
                      <div>
                        <p className="font-medium text-sm">
                          {tx.type === "transfer"
                            ? (tx.metadata?.direction === "inbound" ? "Transfer in" : "Transfer out")
                            : (tx.product_name || tx.type)}
                        </p>
                        <p className="text-xs text-neutral-400">
                          {new Date(tx.created_at).toLocaleString()}
                          {tx.type === "transfer" && tx.metadata?.counterparty_address && (
                            <span className="ml-1 font-mono">
                              {tx.metadata.direction === "inbound" ? "from " : "to "}
                              {tx.metadata.counterparty_address.slice(0, 6)}...{tx.metadata.counterparty_address.slice(-4)}
                            </span>
                          )}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <StatusBadge status={tx.status} />
                      {tx.order_status && tx.order_status !== "pending" && (
                        <StatusBadge status={tx.order_status} />
                      )}
                      <div className="text-right">
                        <span className={`font-semibold text-sm ${tx.type === "transfer" ? (tx.metadata?.direction === "inbound" ? "text-emerald-600" : "text-red-600") : ""}`} data-testid={`text-amount-${tx.id}`}>
                          {tx.type === "transfer" ? (tx.metadata?.direction === "inbound" ? "+" : "-") : ""}{tx.amount_display}
                        </span>
                        {tx.balance_after_display && (
                          <p className="text-xs text-neutral-400" data-testid={`text-balance-after-${tx.id}`}>bal: {tx.balance_after_display}</p>
                        )}
                      </div>
                      <Eye className="w-4 h-4 text-neutral-400" />
                    </div>
                  </div>
                  {tx.tracking_info && (
                    <div className="mt-2 flex items-center gap-2 text-xs text-neutral-500">
                      <Truck className="w-3 h-3" />
                      {(tx.tracking_info as Record<string, string>).carrier && (
                        <span>{(tx.tracking_info as Record<string, string>).carrier}</span>
                      )}
                      {(tx.tracking_info as Record<string, string>).tracking_number && (
                        <span className="font-mono">{(tx.tracking_info as Record<string, string>).tracking_number}</span>
                      )}
                      {!(tx.tracking_info as Record<string, string>).carrier && !(tx.tracking_info as Record<string, string>).tracking_number && (
                        <span>Tracking info available</span>
                      )}
                    </div>
                  )}
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
          title: "Create Card Wallet",
          description: "Select a bot to create a CrossMint Card Wallet for commerce purchases.",
          endpoint: "/api/v1/card-wallet/create",
          buttonLabel: "Create Card Wallet",
          buttonIcon: <ShoppingCart className="w-4 h-4" />,
          successMessage: "Card Wallet created",
        }}
        onCreated={fetchWallets}
      />

      <GuardrailDialog
        open={guardrails.guardrailsDialogOpen}
        onOpenChange={guardrails.setGuardrailsDialogOpen}
        form={guardrails.form}
        onFormChange={(f) => guardrails.setForm(f as CardGuardrailForm)}
        saving={guardrails.saving}
        onSave={guardrails.save}
        variant="card"
        walletName={guardrails.selectedWallet?.bot_name}
      />

      <Dialog open={fundDialogOpen} onOpenChange={(open) => { if (!open) handleCloseFund(); }}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto" data-testid="dialog-fund">
          <DialogTitle>
            Fund Wallet {fundWallet ? `— ${fundWallet.bot_name}` : ""}
          </DialogTitle>
          <DialogDescription>
            Buy USDC with your credit card via CrossMint. Funds will be delivered directly to your wallet on Base.
          </DialogDescription>

          {!fundOrderData ? (
            <div className="space-y-4 mt-4">
              <div>
                <Label className="text-sm">Amount (USD)</Label>
                <Input
                  type="number"
                  min="1"
                  value={fundAmount}
                  onChange={(e) => setFundAmount(e.target.value)}
                  placeholder="25"
                  data-testid="input-fund-amount"
                />
                <p className="text-xs text-neutral-400 mt-1">Minimum $1. You can fund more later.</p>
              </div>
              <Button
                onClick={handleStartFund}
                disabled={fundLoading || !fundAmount || Number(fundAmount) < 1}
                className="w-full bg-violet-600 hover:bg-violet-700 gap-2"
                data-testid="button-start-fund"
              >
                {fundLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CreditCard className="w-4 h-4" />}
                Continue to Payment
              </Button>
            </div>
          ) : fundEmbedError ? (
            <div className="space-y-4 mt-4 text-center">
              <p className="text-sm text-neutral-600">
                The embedded checkout couldn't load. Click below to complete payment in a new tab.
              </p>
              <Button
                onClick={() => {
                  window.open(`https://www.crossmint.com/checkout?orderId=${fundOrderData.orderId}`, "_blank");
                  toast({ title: "CrossMint checkout opened in a new tab" });
                }}
                className="w-full bg-violet-600 hover:bg-violet-700 gap-2"
                data-testid="button-fund-redirect"
              >
                <ExternalLink className="w-4 h-4" />
                Open CrossMint Checkout
              </Button>
            </div>
          ) : (
            <div className="mt-4">
              {process.env.NEXT_PUBLIC_CROSSMINT_CLIENT_API_KEY ? (
                <CrossmintProvider apiKey={process.env.NEXT_PUBLIC_CROSSMINT_CLIENT_API_KEY}>
                  <CrossmintCheckoutWrapper
                    orderId={fundOrderData.orderId}
                    clientSecret={fundOrderData.clientSecret}
                    onError={() => setFundEmbedError(true)}
                    onSuccess={() => {
                      toast({ title: "Funding complete!", description: "USDC has been delivered to your wallet." });
                      handleCloseFund();
                    }}
                  />
                </CrossmintProvider>
              ) : (
                <div className="text-center py-8">
                  <p className="text-sm text-neutral-500 mb-4">Embedded checkout is not configured. Use the redirect instead.</p>
                  <Button
                    onClick={() => setFundEmbedError(true)}
                    className="bg-violet-600 hover:bg-violet-700"
                  >
                    Open CrossMint Checkout
                  </Button>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={orderDetailOpen} onOpenChange={setOrderDetailOpen}>
        <DialogContent className="sm:max-w-lg" data-testid="dialog-order-detail">
          <DialogTitle>Order Details</DialogTitle>
          <DialogDescription>
            {orderDetailTx?.product_name || "Order"} — {orderDetailTx?.amount_display}
          </DialogDescription>
          {orderDetailTx && (
            <div className="space-y-4 mt-2">
              <OrderTimeline orderStatus={orderDetailTx.order_status} />

              <div className="grid grid-cols-2 gap-3">
                <div className="bg-neutral-50 rounded-lg p-3">
                  <p className="text-xs text-neutral-500">Amount</p>
                  <p className="text-sm font-semibold text-neutral-900" data-testid="text-order-amount">{orderDetailTx.amount_display}</p>
                </div>
                <div className="bg-neutral-50 rounded-lg p-3">
                  <p className="text-xs text-neutral-500">Quantity</p>
                  <p className="text-sm font-semibold text-neutral-900">{orderDetailTx.quantity}</p>
                </div>
                <div className="bg-neutral-50 rounded-lg p-3">
                  <p className="text-xs text-neutral-500">Status</p>
                  <StatusBadge status={orderDetailTx.status} />
                </div>
                <div className="bg-neutral-50 rounded-lg p-3">
                  <p className="text-xs text-neutral-500">Order Status</p>
                  <StatusBadge status={orderDetailTx.order_status || "pending"} />
                </div>
              </div>

              {!orderDetailTx.tracking_info && (!orderDetailTx.product_locator || !orderDetailTx.product_locator.startsWith("amazon:")) && orderDetailTx.order_status && !["pending", "requires_approval"].includes(orderDetailTx.order_status) && (
                <div className="bg-amber-50 border border-amber-100 rounded-lg p-3" data-testid="tracking-unavailable-note">
                  <p className="text-xs text-amber-700">Package tracking is currently available for Amazon orders only. Check the merchant directly for shipping updates.</p>
                </div>
              )}

              {orderDetailTx.tracking_info && (
                <div className="bg-indigo-50 border border-indigo-100 rounded-lg p-4" data-testid="tracking-info-section">
                  <div className="flex items-center gap-2 mb-2">
                    <Truck className="w-4 h-4 text-indigo-600" />
                    <h4 className="text-sm font-semibold text-indigo-800">Tracking Information</h4>
                  </div>
                  <div className="space-y-1.5">
                    {(orderDetailTx.tracking_info as Record<string, string>).carrier && (
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-indigo-600">Carrier</span>
                        <span className="font-medium text-indigo-900">{(orderDetailTx.tracking_info as Record<string, string>).carrier}</span>
                      </div>
                    )}
                    {(orderDetailTx.tracking_info as Record<string, string>).tracking_number && (
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-indigo-600">Tracking #</span>
                        <span className="font-mono text-indigo-900">{(orderDetailTx.tracking_info as Record<string, string>).tracking_number}</span>
                      </div>
                    )}
                    {(orderDetailTx.tracking_info as Record<string, string>).estimated_delivery && (
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-indigo-600">Est. Delivery</span>
                        <span className="text-indigo-900">{(orderDetailTx.tracking_info as Record<string, string>).estimated_delivery}</span>
                      </div>
                    )}
                    {(orderDetailTx.tracking_info as Record<string, string>).tracking_url && (
                      <a
                        href={(orderDetailTx.tracking_info as Record<string, string>).tracking_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 mt-2 text-sm font-medium text-indigo-700 hover:text-indigo-900"
                        data-testid="link-tracking-url"
                      >
                        <ExternalLink className="w-3 h-3" /> Track Package
                      </a>
                    )}
                  </div>
                </div>
              )}

              {orderDetailTx.shipping_address && (
                <div className="bg-neutral-50 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <MapPin className="w-4 h-4 text-neutral-500" />
                    <h4 className="text-sm font-semibold text-neutral-700">Shipping Address</h4>
                  </div>
                  <p className="text-sm text-neutral-600">
                    {Object.values(orderDetailTx.shipping_address).filter(Boolean).join(", ")}
                  </p>
                </div>
              )}

              {orderDetailTx.crossmint_order_id && (
                <div className="flex items-center justify-between">
                  <code className="text-xs text-neutral-400 font-mono" data-testid="text-crossmint-order-id">
                    Order: {orderDetailTx.crossmint_order_id.slice(0, 12)}...
                  </code>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleRefreshOrder}
                    disabled={orderRefreshing}
                    className="gap-1 text-violet-600 border-violet-200 hover:bg-violet-50"
                    data-testid="button-refresh-order"
                  >
                    <RefreshCw className={`w-3 h-3 ${orderRefreshing ? "animate-spin" : ""}`} />
                    Refresh Status
                  </Button>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

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
    </div>
  );
}
