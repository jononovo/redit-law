"use client";

import { Loader2 } from "lucide-react";
import type { PaymentMethodDef } from "../types";

interface PaymentMethodSelectorProps {
  methods: PaymentMethodDef[];
  onSelect: (methodId: string) => void;
  loading?: string;
  disabled?: boolean;
  amount?: number;
  buttonLabel?: string;
}

export function PaymentMethodSelector({
  methods,
  onSelect,
  loading,
  disabled,
  amount,
  buttonLabel = "Pay",
}: PaymentMethodSelectorProps) {
  if (methods.length === 0) {
    return (
      <div className="text-center py-6 text-neutral-400 text-sm">
        No payment methods available
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3" data-testid="payment-method-selector">
      {methods.map((method) => {
        const isLoading = loading === method.id;
        const isDisabled = disabled || (!!loading && !isLoading);

        return (
          <button
            key={method.id}
            onClick={() => onSelect(method.id)}
            disabled={isDisabled}
            className={`
              w-full flex items-center gap-4 px-5 py-4 rounded-xl border-2 transition-all cursor-pointer
              ${isLoading
                ? "border-[#E8735A] bg-[#E8735A]/5"
                : "border-neutral-200 hover:border-[#E8735A] hover:bg-neutral-50"
              }
              ${isDisabled && !isLoading ? "opacity-50 cursor-not-allowed" : ""}
            `}
            data-testid={`payment-method-${method.id}`}
          >
            <span className="text-2xl flex-shrink-0">{method.iconEmoji}</span>

            <div className="flex-1 text-left">
              <div className="flex items-center gap-2">
                <span className="font-bold text-neutral-900">
                  {amount ? `${buttonLabel} $${amount.toFixed(2)}` : buttonLabel}
                </span>
                <span className="text-sm font-medium text-neutral-500">{method.label}</span>
              </div>
              <p className="text-xs text-neutral-400 mt-0.5">{method.subtitle}</p>
            </div>

            {isLoading && (
              <Loader2 className="w-5 h-5 animate-spin text-[#E8735A] flex-shrink-0" />
            )}
          </button>
        );
      })}
    </div>
  );
}
