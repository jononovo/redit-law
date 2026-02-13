"use client";

import { useState, useEffect, useCallback } from "react";
import { Loader2, ShoppingCart, Plus, Shield, Snowflake, Play, Copy, CheckCircle2, Clock, XCircle, DollarSign, Package, Truck, ExternalLink, Ban } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/lib/auth/auth-context";
import { authFetch } from "@/lib/auth-fetch";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";

interface WalletInfo {
  id: number;
  bot_id: string;
  bot_name: string;
  address: string;
  balance_usdc: number;
  balance_display: string;
  chain: string;
  status: string;
  guardrails: {
    max_per_tx_usdc: number;
    daily_budget_usdc: number;
    monthly_budget_usdc: number;
    require_approval_above: number;
    allowlisted_merchants: string[] | null;
    blocklisted_merchants: string[] | null;
    auto_pause_on_zero: boolean;
  } | null;
  created_at: string;
}

interface TransactionInfo {
  id: number;
  type: string;
  amount_usdc: number;
  amount_display: string;
  product_locator: string | null;
  product_name: string | null;
  quantity: number;
  order_status: string | null;
  status: string;
  crossmint_order_id: string | null;
  shipping_address: Record<string, string> | null;
  tracking_info: Record<string, string> | null;
  created_at: string;
}

interface ApprovalInfo {
  id: number;
  wallet_id: number;
  amount_usdc: number;
  amount_display: string;
  product_locator: string;
  product_name: string;
  shipping_address: Record<string, string> | null;
  status: string;
  expires_at: string;
  created_at: string;
  bot_name: string;
  wallet_balance_display: string;
}

interface BotInfo {
  bot_id: string;
  bot_name: string;
}

function microUsdcToDisplay(microUsdc: number): string {
  return `$${(microUsdc / 1_000_000).toFixed(2)}`;
}

function StatusBadge({ status }: { status: string }) {
  const colorMap: Record<string, string> = {
    active: "bg-emerald-50 text-emerald-700 border-emerald-200",
    paused: "bg-amber-50 text-amber-700 border-amber-200",
    pending: "bg-blue-50 text-blue-700 border-blue-200",
    confirmed: "bg-emerald-50 text-emerald-700 border-emerald-200",
    processing: "bg-blue-50 text-blue-700 border-blue-200",
    shipped: "bg-indigo-50 text-indigo-700 border-indigo-200",
    delivered: "bg-emerald-50 text-emerald-700 border-emerald-200",
    failed: "bg-red-50 text-red-700 border-red-200",
    requires_approval: "bg-amber-50 text-amber-700 border-amber-200",
    approved: "bg-emerald-50 text-emerald-700 border-emerald-200",
    rejected: "bg-red-50 text-red-700 border-red-200",
    expired: "bg-neutral-100 text-neutral-500 border-neutral-200",
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${colorMap[status] || "bg-neutral-100 text-neutral-600 border-neutral-200"}`} data-testid={`status-${status}`}>
      {status.replace(/_/g, " ")}
    </span>
  );
}

export default function CardWalletPage() {
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

  const [guardrailForm, setGuardrailForm] = useState({
    max_per_tx_usdc: 50,
    daily_budget_usdc: 250,
    monthly_budget_usdc: 1000,
    require_approval_above: 0,
    allowlisted_merchants: "",
    blocklisted_merchants: "",
    auto_pause_on_zero: true,
  });
  const [savingGuardrails, setSavingGuardrails] = useState(false);

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

  const fetchBots = useCallback(async () => {
    try {
      const res = await authFetch("/api/v1/bots");
      if (res.ok) {
        const data = await res.json();
        setBots(data.bots || []);
      }
    } catch {}
  }, []);

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

  useEffect(() => {
    if (user) {
      fetchWallets();
      fetchBots();
      fetchApprovals();
    }
  }, [user, fetchWallets, fetchBots, fetchApprovals]);

  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);

  const handleCreate = async () => {
    if (!selectedBotId) return;
    setCreating(true);
    try {
      const res = await authFetch("/api/v1/card-wallet/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bot_id: selectedBotId }),
      });
      if (res.ok) {
        toast({ title: "Card Wallet created" });
        setCreateDialogOpen(false);
        fetchWallets();
      } else {
        const data = await res.json();
        toast({ title: "Error", description: data.error, variant: "destructive" });
      }
    } catch {
      toast({ title: "Failed to create wallet", variant: "destructive" });
    } finally {
      setCreating(false);
    }
  };

  const handleFreeze = async (wallet: WalletInfo) => {
    try {
      const res = await authFetch("/api/v1/card-wallet/freeze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ wallet_id: wallet.id }),
      });
      if (res.ok) {
        toast({ title: wallet.status === "active" ? "Wallet paused" : "Wallet activated" });
        fetchWallets();
      }
    } catch {
      toast({ title: "Failed to update wallet status", variant: "destructive" });
    }
  };

  const handleSaveGuardrails = async () => {
    if (!selectedWallet) return;
    setSavingGuardrails(true);
    try {
      const allowlisted = guardrailForm.allowlisted_merchants.split(",").map(s => s.trim()).filter(Boolean);
      const blocklisted = guardrailForm.blocklisted_merchants.split(",").map(s => s.trim()).filter(Boolean);

      const res = await authFetch("/api/v1/card-wallet/guardrails", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          wallet_id: selectedWallet.id,
          max_per_tx_usdc: guardrailForm.max_per_tx_usdc * 1_000_000,
          daily_budget_usdc: guardrailForm.daily_budget_usdc * 1_000_000,
          monthly_budget_usdc: guardrailForm.monthly_budget_usdc * 1_000_000,
          require_approval_above: guardrailForm.require_approval_above * 1_000_000,
          allowlisted_merchants: allowlisted.length > 0 ? allowlisted : null,
          blocklisted_merchants: blocklisted.length > 0 ? blocklisted : null,
          auto_pause_on_zero: guardrailForm.auto_pause_on_zero,
        }),
      });
      if (res.ok) {
        toast({ title: "Guardrails updated" });
        setGuardrailsDialogOpen(false);
        fetchWallets();
      } else {
        const data = await res.json();
        toast({ title: "Error", description: data.error, variant: "destructive" });
      }
    } catch {
      toast({ title: "Failed to save guardrails", variant: "destructive" });
    } finally {
      setSavingGuardrails(false);
    }
  };

  const handleApprovalDecision = async (approvalId: number, decision: "approve" | "reject") => {
    try {
      const res = await authFetch("/api/v1/card-wallet/approvals/decide", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ approval_id: approvalId, decision }),
      });
      if (res.ok) {
        toast({ title: decision === "approve" ? "Purchase approved" : "Purchase rejected" });
        fetchApprovals();
        fetchTransactions();
      } else {
        const data = await res.json();
        toast({ title: "Error", description: data.error, variant: "destructive" });
      }
    } catch {
      toast({ title: "Failed to process decision", variant: "destructive" });
    }
  };

  const openGuardrailsDialog = (wallet: WalletInfo) => {
    setSelectedWallet(wallet);
    if (wallet.guardrails) {
      setGuardrailForm({
        max_per_tx_usdc: wallet.guardrails.max_per_tx_usdc / 1_000_000,
        daily_budget_usdc: wallet.guardrails.daily_budget_usdc / 1_000_000,
        monthly_budget_usdc: wallet.guardrails.monthly_budget_usdc / 1_000_000,
        require_approval_above: (wallet.guardrails.require_approval_above || 0) / 1_000_000,
        allowlisted_merchants: (wallet.guardrails.allowlisted_merchants || []).join(", "),
        blocklisted_merchants: (wallet.guardrails.blocklisted_merchants || []).join(", "),
        auto_pause_on_zero: wallet.guardrails.auto_pause_on_zero ?? true,
      });
    }
    setGuardrailsDialogOpen(true);
  };

  const copyAddress = (address: string) => {
    navigator.clipboard.writeText(address);
    toast({ title: "Address copied" });
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
                    onClick={() => handleApprovalDecision(a.id, "reject")}
                    data-testid={`button-reject-${a.id}`}
                  >
                    <XCircle className="w-4 h-4 mr-1" />
                    Reject
                  </Button>
                  <Button
                    size="sm"
                    className="bg-emerald-600 hover:bg-emerald-700"
                    onClick={() => handleApprovalDecision(a.id, "approve")}
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
            <div className="grid gap-4">
              {wallets.map((wallet) => (
                <div key={wallet.id} className="bg-white rounded-xl border border-neutral-100 p-6 hover:shadow-sm transition-shadow" data-testid={`wallet-card-${wallet.id}`}>
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-violet-50 flex items-center justify-center">
                        <ShoppingCart className="w-5 h-5 text-violet-600" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-neutral-900">{wallet.bot_name}</h3>
                        <div className="flex items-center gap-2 mt-0.5">
                          <code className="text-xs text-neutral-400 font-mono">{wallet.address.slice(0, 8)}...{wallet.address.slice(-6)}</code>
                          <button onClick={() => copyAddress(wallet.address)} className="text-neutral-400 hover:text-neutral-600" data-testid={`button-copy-${wallet.id}`}>
                            <Copy className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <StatusBadge status={wallet.status} />
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleFreeze(wallet)}
                        className={wallet.status === "active" ? "text-amber-600 hover:text-amber-700" : "text-emerald-600 hover:text-emerald-700"}
                        data-testid={`button-freeze-${wallet.id}`}
                      >
                        {wallet.status === "active" ? <Snowflake className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => openGuardrailsDialog(wallet)}
                        data-testid={`button-guardrails-${wallet.id}`}
                      >
                        <Shield className="w-4 h-4 text-neutral-500" />
                      </Button>
                    </div>
                  </div>

                  <div className="grid grid-cols-4 gap-4">
                    <div className="bg-neutral-50 rounded-lg p-3">
                      <p className="text-xs text-neutral-500">Balance</p>
                      <p className="text-lg font-bold text-neutral-900" data-testid={`text-balance-${wallet.id}`}>{wallet.balance_display}</p>
                    </div>
                    <div className="bg-neutral-50 rounded-lg p-3">
                      <p className="text-xs text-neutral-500">Chain</p>
                      <p className="text-sm font-medium text-neutral-700">{wallet.chain}</p>
                    </div>
                    <div className="bg-neutral-50 rounded-lg p-3">
                      <p className="text-xs text-neutral-500">Per-Tx Limit</p>
                      <p className="text-sm font-medium text-neutral-700">{wallet.guardrails ? microUsdcToDisplay(wallet.guardrails.max_per_tx_usdc) : "—"}</p>
                    </div>
                    <div className="bg-neutral-50 rounded-lg p-3">
                      <p className="text-xs text-neutral-500">Daily Budget</p>
                      <p className="text-sm font-medium text-neutral-700">{wallet.guardrails ? microUsdcToDisplay(wallet.guardrails.daily_budget_usdc) : "—"}</p>
                    </div>
                  </div>

                  {wallet.guardrails && (wallet.guardrails.allowlisted_merchants?.length || wallet.guardrails.blocklisted_merchants?.length) ? (
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {wallet.guardrails.allowlisted_merchants?.map((m) => (
                        <Badge key={m} variant="outline" className="text-emerald-700 border-emerald-200 bg-emerald-50 text-xs">{m}</Badge>
                      ))}
                      {wallet.guardrails.blocklisted_merchants?.map((m) => (
                        <Badge key={m} variant="outline" className="text-red-700 border-red-200 bg-red-50 text-xs"><Ban className="w-3 h-3 mr-1" />{m}</Badge>
                      ))}
                    </div>
                  ) : null}
                </div>
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
                <div key={tx.id} className="bg-white rounded-xl border border-neutral-100 p-4" data-testid={`transaction-card-${tx.id}`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${tx.type === "purchase" ? "bg-violet-50" : "bg-emerald-50"}`}>
                        {tx.type === "purchase" ? <ShoppingCart className="w-4 h-4 text-violet-600" /> : <DollarSign className="w-4 h-4 text-emerald-600" />}
                      </div>
                      <div>
                        <p className="font-medium text-sm">{tx.product_name || tx.type}</p>
                        <p className="text-xs text-neutral-400">{new Date(tx.created_at).toLocaleString()}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <StatusBadge status={tx.status} />
                      {tx.order_status && tx.order_status !== "pending" && (
                        <StatusBadge status={tx.order_status} />
                      )}
                      <span className="font-semibold text-sm" data-testid={`text-amount-${tx.id}`}>{tx.amount_display}</span>
                    </div>
                  </div>
                  {tx.tracking_info && (
                    <div className="mt-2 flex items-center gap-2 text-xs text-neutral-500">
                      <Truck className="w-3 h-3" />
                      <span>Tracking: {JSON.stringify(tx.tracking_info)}</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent>
          <DialogTitle>Create Card Wallet</DialogTitle>
          <DialogDescription>Select a bot to create a CrossMint Card Wallet for commerce purchases.</DialogDescription>
          <div className="space-y-4 mt-4">
            <div>
              <Label>Select Bot</Label>
              <select
                value={selectedBotId}
                onChange={(e) => setSelectedBotId(e.target.value)}
                className="w-full border rounded-lg px-3 py-2 mt-1 text-sm"
                data-testid="select-bot-create"
              >
                <option value="">Choose a bot...</option>
                {bots.map((b) => (
                  <option key={b.bot_id} value={b.bot_id}>{b.bot_name}</option>
                ))}
              </select>
            </div>
            <Button
              onClick={handleCreate}
              disabled={!selectedBotId || creating}
              className="w-full"
              data-testid="button-confirm-create"
            >
              {creating ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <ShoppingCart className="w-4 h-4 mr-2" />}
              Create Card Wallet
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={guardrailsDialogOpen} onOpenChange={setGuardrailsDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogTitle>Spending Guardrails</DialogTitle>
          <DialogDescription>Configure spending limits and merchant controls for {selectedWallet?.bot_name}.</DialogDescription>
          <div className="space-y-4 mt-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-xs">Max per Transaction ($)</Label>
                <Input
                  type="number"
                  value={guardrailForm.max_per_tx_usdc}
                  onChange={(e) => setGuardrailForm({ ...guardrailForm, max_per_tx_usdc: Number(e.target.value) })}
                  data-testid="input-max-per-tx"
                />
              </div>
              <div>
                <Label className="text-xs">Daily Budget ($)</Label>
                <Input
                  type="number"
                  value={guardrailForm.daily_budget_usdc}
                  onChange={(e) => setGuardrailForm({ ...guardrailForm, daily_budget_usdc: Number(e.target.value) })}
                  data-testid="input-daily-budget"
                />
              </div>
              <div>
                <Label className="text-xs">Monthly Budget ($)</Label>
                <Input
                  type="number"
                  value={guardrailForm.monthly_budget_usdc}
                  onChange={(e) => setGuardrailForm({ ...guardrailForm, monthly_budget_usdc: Number(e.target.value) })}
                  data-testid="input-monthly-budget"
                />
              </div>
              <div>
                <Label className="text-xs">Require Approval Above ($)</Label>
                <Input
                  type="number"
                  value={guardrailForm.require_approval_above}
                  onChange={(e) => setGuardrailForm({ ...guardrailForm, require_approval_above: Number(e.target.value) })}
                  data-testid="input-require-approval"
                />
              </div>
            </div>

            <div>
              <Label className="text-xs">Allowlisted Merchants (comma-separated)</Label>
              <Input
                value={guardrailForm.allowlisted_merchants}
                onChange={(e) => setGuardrailForm({ ...guardrailForm, allowlisted_merchants: e.target.value })}
                placeholder="amazon, walmart"
                data-testid="input-allowlisted-merchants"
              />
              <p className="text-xs text-neutral-400 mt-1">Leave empty to allow all merchants</p>
            </div>

            <div>
              <Label className="text-xs">Blocklisted Merchants (comma-separated)</Label>
              <Input
                value={guardrailForm.blocklisted_merchants}
                onChange={(e) => setGuardrailForm({ ...guardrailForm, blocklisted_merchants: e.target.value })}
                placeholder="ebay"
                data-testid="input-blocklisted-merchants"
              />
            </div>

            <div className="flex items-center justify-between">
              <Label className="text-xs">Auto-pause wallet when balance reaches $0</Label>
              <Switch
                checked={guardrailForm.auto_pause_on_zero}
                onCheckedChange={(checked) => setGuardrailForm({ ...guardrailForm, auto_pause_on_zero: checked })}
                data-testid="switch-auto-pause"
              />
            </div>

            <Button
              onClick={handleSaveGuardrails}
              disabled={savingGuardrails}
              className="w-full"
              data-testid="button-save-guardrails"
            >
              {savingGuardrails ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Shield className="w-4 h-4 mr-2" />}
              Save Guardrails
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
