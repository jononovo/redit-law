"use client";

import { useEffect, useState, useCallback } from "react";
import { authFetch } from "@/lib/auth-fetch";
import { Shield, Trash2, RefreshCw, Clock, Activity, CheckCircle2, Loader2, MoreVertical, Settings } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { Rail4SetupWizard } from "./rail4-setup-wizard";

interface Rail4Status {
  configured: boolean;
  status: string | null;
  decoy_filename?: string;
  real_profile_index?: number;
  missing_digit_positions?: number[];
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
  const [wizardOpen, setWizardOpen] = useState(false);

  const [permissions, setPermissions] = useState<Permissions>({
    profile_index: 0,
    allowance_duration: "month",
    allowance_value: 500,
    confirmation_exempt_limit: 50,
    human_permission_required: "above_exempt",
  });
  const [permSaving, setPermSaving] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const [obfStatus, setObfStatus] = useState<ObfuscationStatus | null>(null);
  const [obfHistory, setObfHistory] = useState<ObfuscationEntry[]>([]);
  const [confirmations, setConfirmations] = useState<Confirmation[]>([]);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const isConfigured = rail4Status?.configured === true;
  const isActive = rail4Status?.status === "active";
  const isPendingSetup = rail4Status?.status === "pending_setup";

  const fetchStatus = useCallback(async () => {
    try {
      const res = await authFetch(`/api/v1/rail4/status?bot_id=${botId}`);
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
        authFetch(`/api/v1/rail4/obfuscation/status?bot_id=${botId}`),
        authFetch(`/api/v1/rail4/obfuscation/history?bot_id=${botId}`),
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
      const res = await authFetch(`/api/v1/rail4/confirmations`);
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
      const res = await authFetch(`/api/v1/rail4/permissions?bot_id=${botId}`);
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

  async function handleDelete() {
    setDeleting(true);
    try {
      const res = await authFetch(`/api/v1/rail4?bot_id=${botId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete");
      toast({ title: "Card Deleted", description: "Self-hosted card has been removed." });
      setDeleteOpen(false);
      setRail4Status(null);
    } catch {
      toast({ title: "Delete failed", description: "Please try again.", variant: "destructive" });
    } finally {
      setDeleting(false);
    }
  }

  async function handleSavePermissions() {
    setPermSaving(true);
    try {
      const res = await authFetch("/api/v1/rail4/permissions", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bot_id: botId, permissions }),
      });
      if (!res.ok) throw new Error("Failed to save");
      toast({ title: "Permissions Saved", description: "Card permissions updated. Remember to also update your local payment profiles file." });
      setSettingsOpen(false);
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

  if (!isConfigured || isPendingSetup) {
    return (
      <>
        <Rail4SetupWizard
          botId={botId}
          open={wizardOpen}
          onOpenChange={setWizardOpen}
          onComplete={fetchStatus}
        />
        <Card className="rounded-2xl border-neutral-100 shadow-sm" data-testid="card-rail4-setup">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base font-bold text-neutral-900">
              <Shield className="w-4 h-4" />
              {isPendingSetup ? "Card Setup Incomplete" : "Set Up Self-Hosted Card"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-neutral-500">
              {isPendingSetup
                ? "Your payment profiles were started but you haven't finished entering your card details yet. Click below to continue."
                : "This will generate a payment profiles file with fake card profiles. Your real card details are split — neither your bot nor CreditClaw ever holds the full number."}
            </p>
            <div className="flex gap-3">
              <Button
                onClick={() => setWizardOpen(true)}
                className="rounded-xl bg-primary hover:bg-primary/90 gap-2"
                data-testid="button-start-setup-wizard"
              >
                <Shield className="w-4 h-4" />
                {isPendingSetup ? "Continue Setup" : "Start Card Setup"}
              </Button>
              {isPendingSetup && (
                <Button
                  variant="outline"
                  className="rounded-xl gap-2 text-red-600 border-red-200 hover:bg-red-50"
                  onClick={handleDelete}
                  disabled={deleting}
                  data-testid="button-delete-pending"
                >
                  {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                  Delete
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </>
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
            <div className="flex items-center gap-2">
              <Badge
                className={`border-0 ${isActive ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"}`}
                data-testid="badge-card-status"
              >
                {isActive ? "Active" : "Pending"}
              </Badge>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-8 w-8 p-0" data-testid="button-card-menu">
                    <MoreVertical className="w-4 h-4 text-neutral-500" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="rounded-xl">
                  <DropdownMenuItem
                    onClick={() => {
                      fetchPermissions();
                      setSettingsOpen(true);
                    }}
                    className="gap-2 cursor-pointer"
                    data-testid="menu-item-settings"
                  >
                    <Settings className="w-4 h-4" />
                    Settings
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => setDeleteOpen(true)}
                    className="gap-2 cursor-pointer text-red-600 focus:text-red-600"
                    data-testid="menu-item-delete"
                  >
                    <Trash2 className="w-4 h-4" />
                    Delete Card
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {rail4Status?.decoy_filename && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-neutral-500">Payment Profiles</span>
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
        </CardContent>
      </Card>

      <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
        <DialogContent className="max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Settings className="w-5 h-5" />
              Card Settings
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
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
                  <SelectItem value="day">Daily</SelectItem>
                  <SelectItem value="week">Weekly</SelectItem>
                  <SelectItem value="month">Monthly</SelectItem>
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

            <div className="bg-amber-50 rounded-xl border border-amber-100 p-3 text-left">
              <p className="text-xs text-amber-700 leading-relaxed">
                After saving, remember to also update the permissions in your local payment profiles file to keep them in sync.
              </p>
            </div>

            <Button
              onClick={handleSavePermissions}
              disabled={permSaving}
              className="w-full rounded-xl bg-primary hover:bg-primary/90 gap-2"
              data-testid="button-save-permissions"
            >
              {permSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
              Save Permissions
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
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
