"use client";

import { useState, useCallback } from "react";
import { authFetch } from "@/lib/auth-fetch";
import { useToast } from "@/hooks/use-toast";
import type { CryptoGuardrailForm, CardGuardrailForm, GuardrailForm } from "@/components/wallet/dialogs/guardrail-dialog";

export interface UseGuardrailsConfig {
  railPrefix: string;
  variant: "crypto" | "card";
  onUpdate?: () => void;
}

interface GuardrailWallet {
  id: number;
  bot_name?: string;
  guardrails?: any;
}

export function useGuardrails(config: UseGuardrailsConfig) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [walletId, setWalletId] = useState<number | null>(null);
  const [walletName, setWalletName] = useState<string | undefined>();

  const defaultCryptoForm: CryptoGuardrailForm = {
    max_per_tx_usdc: 100,
    daily_budget_usdc: 1000,
    monthly_budget_usdc: 10000,
    require_approval_above: null,
  };

  const defaultCardForm: CardGuardrailForm = {
    max_per_tx_usdc: 50,
    daily_budget_usdc: 250,
    monthly_budget_usdc: 1000,
    require_approval_above: 0,
    allowlisted_merchants: "",
    blocklisted_merchants: "",
    auto_pause_on_zero: true,
  };

  const [form, setForm] = useState<GuardrailForm>(
    config.variant === "crypto" ? defaultCryptoForm : defaultCardForm
  );

  const openDialog = useCallback((wallet: GuardrailWallet) => {
    setWalletId(wallet.id);
    setWalletName(wallet.bot_name);

    if (config.variant === "crypto" && wallet.guardrails) {
      setForm({
        max_per_tx_usdc: wallet.guardrails.max_per_tx_usdc,
        daily_budget_usdc: wallet.guardrails.daily_budget_usdc,
        monthly_budget_usdc: wallet.guardrails.monthly_budget_usdc,
        require_approval_above: wallet.guardrails.require_approval_above,
      });
    } else if (config.variant === "card" && wallet.guardrails) {
      setForm({
        max_per_tx_usdc: wallet.guardrails.max_per_tx_usdc / 1_000_000,
        daily_budget_usdc: wallet.guardrails.daily_budget_usdc / 1_000_000,
        monthly_budget_usdc: wallet.guardrails.monthly_budget_usdc / 1_000_000,
        require_approval_above: (wallet.guardrails.require_approval_above || 0) / 1_000_000,
        allowlisted_merchants: (wallet.guardrails.allowlisted_merchants || []).join(", "),
        blocklisted_merchants: (wallet.guardrails.blocklisted_merchants || []).join(", "),
        auto_pause_on_zero: wallet.guardrails.auto_pause_on_zero ?? true,
      });
    }

    setOpen(true);
  }, [config.variant]);

  const handleSave = useCallback(async () => {
    if (walletId === null) return;
    setSaving(true);
    try {
      if (config.variant === "crypto") {
        const res = await authFetch(`/api/v1/${config.railPrefix}/guardrails`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            wallet_id: walletId,
            ...form,
          }),
        });
        if (res.ok) {
          toast({ title: "Guardrails updated" });
          setOpen(false);
          config.onUpdate?.();
        } else {
          toast({ title: "Error", variant: "destructive" });
        }
      } else {
        const cardForm = form as CardGuardrailForm;
        const allowlisted = cardForm.allowlisted_merchants.split(",").map(s => s.trim()).filter(Boolean);
        const blocklisted = cardForm.blocklisted_merchants.split(",").map(s => s.trim()).filter(Boolean);

        const [guardrailRes, procRes] = await Promise.all([
          authFetch(`/api/v1/${config.railPrefix}/guardrails`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              wallet_id: walletId,
              max_per_tx_usdc: cardForm.max_per_tx_usdc * 1_000_000,
              daily_budget_usdc: cardForm.daily_budget_usdc * 1_000_000,
              monthly_budget_usdc: cardForm.monthly_budget_usdc * 1_000_000,
              require_approval_above: cardForm.require_approval_above * 1_000_000,
              auto_pause_on_zero: cardForm.auto_pause_on_zero,
            }),
          }),
          authFetch("/api/v1/procurement-controls", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              scope: "rail2",
              allowlisted_merchants: allowlisted.length > 0 ? allowlisted : [],
              blocklisted_merchants: blocklisted.length > 0 ? blocklisted : [],
            }),
          }),
        ]);
        if (guardrailRes.ok && procRes.ok) {
          toast({ title: "Guardrails updated" });
          setOpen(false);
          config.onUpdate?.();
        } else {
          const data = await (guardrailRes.ok ? procRes : guardrailRes).json();
          toast({ title: "Error", description: data.error, variant: "destructive" });
        }
      }
    } catch {
      toast({ title: "Failed to save guardrails", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }, [walletId, form, config, toast]);

  return {
    open,
    setOpen,
    form,
    setForm,
    saving,
    walletName,
    openDialog,
    handleSave,
  };
}
