"use client";

import { useEffect, useState, useCallback } from "react";
import { Shield, Download, Trash2, RefreshCw, Clock, Activity, CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";

interface Rail4Status {
  status: string;
  decoy_filename?: string;
  created_at?: string;
  card_status?: string;
}

interface ObfuscationStatus {
  phase: string;
  organic_count: number;
  obfuscation_count: number;
  last_organic_at?: string;
  last_obfuscation_at?: string;
}

interface ObfuscationEntry {
  id: string;
  merchant: string;
  item: string;
  amount: number;
  profile_index: number;
  status: string;
  created_at: string;
}

interface Confirmation {
  id: string;
  bot_name: string;
  merchant: string;
  amount: number;
  item: string;
  hmac_token?: string;
}

interface Permissions {
  profile_index: number;
  allowance_duration: string;
  allowance_value: number;
  confirmation_exempt_limit: number;
  human_permission_required: string;
}

interface Rail4CardManagerProps {
  botId: string;
}

export function Rail4CardManager({ botId }: Rail4CardManagerProps) {
  const { toast } = useToast();
  const [rail4Status, setRail4Status] = useState<Rail4Status | null>(null);
  const [loading, setLoading] = useState(true);
  const [initLoading, setInitLoading] = useState(false);
  const [initData, setInitData] = useState<{ decoy_url?: string; instructions?: string } | null>(null);
  const [setupStep, setSetupStep] = useState<"idle" | "initialized" | "form">("idle");

  const [missingDigits, setMissingDigits] = useState("");
  const [expiryMonth, setExpiryMonth] = useState("");
  const [expiryYear, setExpiryYear] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [ownerZip, setOwnerZip] = useState("");
  const [submitLoading, setSubmitLoading] = useState(false);

  const [permissions, setPermissions] = useState<Permissions>({
    profile_index: 0,
    allowance_duration: "month",
    allowance_value: 500,
    confirmation_exempt_limit: 50,
    human_permission_required: "above_exempt",
  });
  const [permSaving, setPermSaving] = useState(false);

  const [obfStatus, setObfStatus] = useState<ObfuscationStatus | null>(null);
  const [obfHistory, setObfHistory] = useState<ObfuscationEntry[]>([]);
  const [confirmations, setConfirmations] = useState<Confirmation[]>([]);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const isActive = rail4Status?.card_status === "active" || rail4Status?.status === "active";

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch(`/api/v1/rail4/status?bot_id=${botId}`);
      if (res.ok) {
        const data = await res.json();
        setRail4Status(data);
      } else {
        setRail4Status(null);
      }
    } catch {
      setRail4Status(null);
    } finally {
      setLoading(false);
    }
  }, [botId]);

  const fetchObfuscation = useCallback(async () => {
    try {
      const [statusRes, historyRes] = await Promise.all([
        fetch(`/api/v1/rail4/obfuscation/status?bot_id=${botId}`),
        fetch(`/api/v1/rail4/obfuscation/history?bot_id=${botId}`),
      ]);
      if (statusRes.ok) setObfStatus(await statusRes.json());
      if (historyRes.ok) {
        const data = await historyRes.json();
        setObfHistory((data.history || data.entries || []).slice(0, 20));
      }
    } catch {}
  }, [botId]);

  const fetchConfirmations = useCallback(async () => {
    try {
      const res = await fetch(`/api/v1/rail4/confirmations`);
      if (res.ok) {
        const data = await res.json();
        setConfirmations(data.confirmations || data || []);
      }
    } catch {}
  }, []);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  const fetchPermissions = useCallback(async () => {
    try {
      const res = await fetch(`/api/v1/rail4/permissions?bot_id=${botId}`);
      if (res.ok) {
        const data = await res.json();
        if (data.permissions) {
          setPermissions(data.permissions);
        }
      }
    } catch {}
  }, [botId]);

  useEffect(() => {
    if (isActive) {
      fetchObfuscation();
      fetchConfirmations();
      fetchPermissions();
    }
  }, [isActive, fetchObfuscation, fetchConfirmations, fetchPermissions]);

  async function handleInitialize() {
    setInitLoading(true);
    try {
      const res = await fetch("/api/v1/rail4/initialize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bot_id: botId }),
      });
      if (!res.ok) throw new Error("Failed to initialize");
      const data = await res.json();
      setInitData(data);
      setSetupStep("initialized");
      toast({ title: "Rail 4 Initialized", description: "Download the decoy file and complete setup." });
    } catch {
      toast({ title: "Initialization failed", description: "Please try again.", variant: "destructive" });
    } finally {
      setInitLoading(false);
    }
  }

  async function handleSubmitOwnerData() {
    if (missingDigits.length !== 3) {
      toast({ title: "Invalid input", description: "Missing digits must be exactly 3 digits.", variant: "destructive" });
      return;
    }
    setSubmitLoading(true);
    try {
      const res = await fetch("/api/v1/rail4/submit-owner-data", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bot_id: botId,
          missing_digits: missingDigits,
          expiry_month: parseInt(expiryMonth),
          expiry_year: parseInt(expiryYear),
          owner_name: ownerName,
          owner_zip: ownerZip,
        }),
      });
      if (!res.ok) throw new Error("Failed to submit");
      toast({ title: "Card Active", description: "Your self-hosted card is now active." });
      setSetupStep("idle");
      fetchStatus();
    } catch {
      toast({ title: "Submission failed", description: "Please check your inputs and try again.", variant: "destructive" });
    } finally {
      setSubmitLoading(false);
    }
  }

  async function handleDelete() {
    setDeleting(true);
    try {
      const res = await fetch(`/api/v1/rail4?bot_id=${botId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete");
      toast({ title: "Card Deleted", description: "Self-hosted card has been removed." });
      setDeleteOpen(false);
      setRail4Status(null);
      setSetupStep("idle");
    } catch {
      toast({ title: "Delete failed", description: "Please try again.", variant: "destructive" });
    } finally {
      setDeleting(false);
    }
  }

  async function handleSavePermissions() {
    setPermSaving(true);
    try {
      const res = await fetch("/api/v1/rail4/permissions", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bot_id: botId, permissions }),
      });
      if (!res.ok) throw new Error("Failed to save");
      toast({ title: "Permissions Saved", description: "Card permissions updated successfully." });
    } catch {
      toast({ title: "Save failed", description: "Please try again.", variant: "destructive" });
    } finally {
      setPermSaving(false);
    }
  }

  function phaseBadge(phase: string) {
    const colors: Record<string, string> = {
      warmup: "bg-amber-100 text-amber-700",
      active: "bg-green-100 text-green-700",
      idle: "bg-neutral-100 text-neutral-500",
    };
    return (
      <Badge className={`${colors[phase] || colors.idle} border-0`} data-testid="badge-obfuscation-phase">
        {phase.charAt(0).toUpperCase() + phase.slice(1)}
      </Badge>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-neutral-400" data-testid="loading-rail4" />
      </div>
    );
  }

  if (!isActive && setupStep === "idle" && !rail4Status) {
    return (
      <Card className="rounded-2xl border-neutral-100 shadow-sm" data-testid="card-rail4-setup">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base font-bold text-neutral-900">
            <Shield className="w-4 h-4" />
            Self-Hosted Card (Rail 4)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-neutral-500 mb-4">
            Set up a self-hosted card with split-knowledge security for this bot.
          </p>
          <Button
            onClick={handleInitialize}
            disabled={initLoading}
            className="rounded-xl bg-primary hover:bg-primary/90 gap-2"
            data-testid="button-initialize-rail4"
          >
            {initLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Shield className="w-4 h-4" />}
            Set Up Self-Hosted Card
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (setupStep === "initialized" && initData) {
    return (
      <Card className="rounded-2xl border-neutral-100 shadow-sm" data-testid="card-rail4-setup-form">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base font-bold text-neutral-900">
            <Shield className="w-4 h-4" />
            Complete Card Setup
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {initData.decoy_url && (
            <div className="bg-neutral-50 rounded-xl border border-neutral-100 p-4">
              <p className="text-sm font-medium text-neutral-700 mb-2">Step 1: Download Decoy File</p>
              <p className="text-xs text-neutral-500 mb-3">
                {initData.instructions || "Download and host this decoy file for card security."}
              </p>
              <a
                href={initData.decoy_url}
                download
                className="inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline"
                data-testid="link-download-decoy"
              >
                <Download className="w-4 h-4" />
                Download Decoy File
              </a>
            </div>
          )}

          <div className="space-y-4">
            <p className="text-sm font-medium text-neutral-700">Step 2: Enter Card Details</p>
            <div className="grid gap-4">
              <div className="space-y-2">
                <Label htmlFor="missing-digits">Missing Digits (3 digits)</Label>
                <Input
                  id="missing-digits"
                  placeholder="123"
                  maxLength={3}
                  value={missingDigits}
                  onChange={(e) => setMissingDigits(e.target.value.replace(/\D/g, "").slice(0, 3))}
                  className="rounded-xl"
                  data-testid="input-missing-digits"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="expiry-month">Expiry Month</Label>
                  <Input
                    id="expiry-month"
                    placeholder="MM"
                    maxLength={2}
                    value={expiryMonth}
                    onChange={(e) => setExpiryMonth(e.target.value.replace(/\D/g, "").slice(0, 2))}
                    className="rounded-xl"
                    data-testid="input-expiry-month"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="expiry-year">Expiry Year</Label>
                  <Input
                    id="expiry-year"
                    placeholder="YYYY"
                    maxLength={4}
                    value={expiryYear}
                    onChange={(e) => setExpiryYear(e.target.value.replace(/\D/g, "").slice(0, 4))}
                    className="rounded-xl"
                    data-testid="input-expiry-year"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="owner-name">Cardholder Name</Label>
                <Input
                  id="owner-name"
                  placeholder="John Doe"
                  value={ownerName}
                  onChange={(e) => setOwnerName(e.target.value)}
                  className="rounded-xl"
                  data-testid="input-owner-name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="owner-zip">Billing ZIP Code</Label>
                <Input
                  id="owner-zip"
                  placeholder="90210"
                  maxLength={10}
                  value={ownerZip}
                  onChange={(e) => setOwnerZip(e.target.value)}
                  className="rounded-xl"
                  data-testid="input-owner-zip"
                />
              </div>
            </div>
            <Button
              onClick={handleSubmitOwnerData}
              disabled={submitLoading || !missingDigits || !expiryMonth || !expiryYear || !ownerName || !ownerZip}
              className="w-full rounded-xl bg-primary hover:bg-primary/90 gap-2"
              data-testid="button-submit-owner-data"
            >
              {submitLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
              Activate Card
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="rounded-2xl border-neutral-100 shadow-sm" data-testid="card-rail4-status">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-base font-bold text-neutral-900">
              <Shield className="w-4 h-4" />
              Self-Hosted Card
            </CardTitle>
            <Badge
              className={`border-0 ${isActive ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"}`}
              data-testid="badge-card-status"
            >
              {isActive ? "Active" : "Pending"}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {rail4Status?.decoy_filename && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-neutral-500">Decoy File</span>
              <span className="font-medium text-neutral-700" data-testid="text-decoy-filename">
                {rail4Status.decoy_filename}
              </span>
            </div>
          )}
          {rail4Status?.created_at && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-neutral-500">Created</span>
              <span className="font-medium text-neutral-700" data-testid="text-created-date">
                {new Date(rail4Status.created_at).toLocaleDateString()}
              </span>
            </div>
          )}
          <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
            <DialogTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="mt-2 rounded-xl gap-2 text-xs text-red-600 border-red-200 hover:bg-red-50"
                data-testid="button-delete-rail4"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Delete Card
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Delete Self-Hosted Card</DialogTitle>
              </DialogHeader>
              <p className="text-sm text-neutral-500">
                Are you sure you want to delete this self-hosted card? This action cannot be undone.
              </p>
              <div className="flex justify-end gap-3 mt-4">
                <Button variant="outline" className="rounded-xl" onClick={() => setDeleteOpen(false)} data-testid="button-cancel-delete">
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  className="rounded-xl gap-2"
                  onClick={handleDelete}
                  disabled={deleting}
                  data-testid="button-confirm-delete"
                >
                  {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                  Delete
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </CardContent>
      </Card>

      {isActive && (
        <Card className="rounded-2xl border-neutral-100 shadow-sm" data-testid="card-permissions-editor">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base font-bold text-neutral-900">
              <Shield className="w-4 h-4" />
              Card Permissions
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4">
              <div className="space-y-2">
                <Label>Allowance Duration</Label>
                <Select
                  value={permissions.allowance_duration}
                  onValueChange={(v) => setPermissions((p) => ({ ...p, allowance_duration: v }))}
                >
                  <SelectTrigger className="rounded-xl" data-testid="select-allowance-duration">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="day">Day</SelectItem>
                    <SelectItem value="week">Week</SelectItem>
                    <SelectItem value="month">Month</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="allowance-value">Allowance Value ($)</Label>
                <Input
                  id="allowance-value"
                  type="number"
                  min={0}
                  value={permissions.allowance_value}
                  onChange={(e) => setPermissions((p) => ({ ...p, allowance_value: parseFloat(e.target.value) || 0 }))}
                  className="rounded-xl"
                  data-testid="input-allowance-value"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="exempt-limit">Confirmation Exempt Limit ($)</Label>
                <Input
                  id="exempt-limit"
                  type="number"
                  min={0}
                  value={permissions.confirmation_exempt_limit}
                  onChange={(e) => setPermissions((p) => ({ ...p, confirmation_exempt_limit: parseFloat(e.target.value) || 0 }))}
                  className="rounded-xl"
                  data-testid="input-exempt-limit"
                />
              </div>
              <div className="space-y-2">
                <Label>Human Permission Required</Label>
                <Select
                  value={permissions.human_permission_required}
                  onValueChange={(v) => setPermissions((p) => ({ ...p, human_permission_required: v }))}
                >
                  <SelectTrigger className="rounded-xl" data-testid="select-human-permission">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Transactions</SelectItem>
                    <SelectItem value="above_exempt">Above Exempt Limit</SelectItem>
                    <SelectItem value="none">None</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <Button
              onClick={handleSavePermissions}
              disabled={permSaving}
              className="rounded-xl bg-primary hover:bg-primary/90 gap-2"
              data-testid="button-save-permissions"
            >
              {permSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
              Save Permissions
            </Button>
          </CardContent>
        </Card>
      )}

      {isActive && (
        <Card className="rounded-2xl border-neutral-100 shadow-sm" data-testid="card-obfuscation-status">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-base font-bold text-neutral-900">
                <Activity className="w-4 h-4" />
                Obfuscation Dashboard
              </CardTitle>
              <Button
                variant="ghost"
                size="sm"
                className="gap-2 text-xs text-neutral-500"
                onClick={fetchObfuscation}
                data-testid="button-refresh-obfuscation"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Refresh
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {obfStatus ? (
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <span className="text-sm text-neutral-500">Phase</span>
                  {phaseBadge(obfStatus.phase)}
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-neutral-50 rounded-xl border border-neutral-100 p-4">
                    <p className="text-xs text-neutral-500 mb-1">Organic</p>
                    <p className="text-xl font-bold text-neutral-900" data-testid="text-organic-count">
                      {obfStatus.organic_count}
                    </p>
                    {obfStatus.last_organic_at && (
                      <p className="text-[11px] text-neutral-400 mt-1 flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {new Date(obfStatus.last_organic_at).toLocaleString()}
                      </p>
                    )}
                  </div>
                  <div className="bg-neutral-50 rounded-xl border border-neutral-100 p-4">
                    <p className="text-xs text-neutral-500 mb-1">Obfuscation</p>
                    <p className="text-xl font-bold text-neutral-900" data-testid="text-obfuscation-count">
                      {obfStatus.obfuscation_count}
                    </p>
                    {obfStatus.last_obfuscation_at && (
                      <p className="text-[11px] text-neutral-400 mt-1 flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {new Date(obfStatus.last_obfuscation_at).toLocaleString()}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-sm text-neutral-400 text-center py-4">No obfuscation data available.</p>
            )}
          </CardContent>
        </Card>
      )}

      {isActive && obfHistory.length > 0 && (
        <Card className="rounded-2xl border-neutral-100 shadow-sm" data-testid="card-obfuscation-history">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base font-bold text-neutral-900">
              <Clock className="w-4 h-4" />
              Obfuscation History
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Merchant</TableHead>
                    <TableHead>Item</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Profile #</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {obfHistory.map((entry) => (
                    <TableRow key={entry.id} data-testid={`row-obfuscation-${entry.id}`}>
                      <TableCell className="text-sm font-medium">{entry.merchant}</TableCell>
                      <TableCell className="text-sm text-neutral-600">{entry.item}</TableCell>
                      <TableCell className="text-sm font-medium">${entry.amount.toFixed(2)}</TableCell>
                      <TableCell className="text-sm text-neutral-600">#{entry.profile_index}</TableCell>
                      <TableCell>
                        <Badge
                          className={`border-0 text-xs ${
                            entry.status === "completed"
                              ? "bg-green-100 text-green-700"
                              : entry.status === "failed"
                                ? "bg-red-100 text-red-700"
                                : "bg-amber-100 text-amber-700"
                          }`}
                          data-testid={`badge-obf-status-${entry.id}`}
                        >
                          {entry.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-neutral-500">
                        {new Date(entry.created_at).toLocaleDateString()}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="rounded-2xl border-neutral-100 shadow-sm" data-testid="card-pending-approvals">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-base font-bold text-neutral-900">
              <CheckCircle2 className="w-4 h-4" />
              Pending Approvals
            </CardTitle>
            <Button
              variant="ghost"
              size="sm"
              className="gap-2 text-xs text-neutral-500"
              onClick={fetchConfirmations}
              data-testid="button-refresh-confirmations"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {confirmations.length === 0 ? (
            <p className="text-sm text-neutral-400 text-center py-4" data-testid="text-no-confirmations">
              No pending approvals.
            </p>
          ) : (
            <div className="space-y-3">
              {confirmations.map((c) => (
                <div
                  key={c.id}
                  className="flex items-center justify-between p-3 rounded-xl bg-neutral-50 border border-neutral-100"
                  data-testid={`confirmation-${c.id}`}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-semibold text-neutral-900">{c.merchant}</span>
                      <span className="text-sm font-medium text-neutral-700">${c.amount.toFixed(2)}</span>
                    </div>
                    <p className="text-xs text-neutral-500 truncate">{c.item}</p>
                    <p className="text-xs text-neutral-400 mt-0.5">{c.bot_name}</p>
                  </div>
                  <div className="flex items-center gap-2 ml-3">
                    <span className="text-xs text-neutral-400 italic flex items-center gap-1" data-testid={`text-check-email-${c.id}`}>
                      <Clock className="w-3 h-3" />
                      Check Email
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
