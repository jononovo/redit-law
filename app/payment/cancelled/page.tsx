"use client";

import { useSearchParams } from "next/navigation";
import { XCircle } from "lucide-react";

export default function PaymentCancelledPage() {
  const searchParams = useSearchParams();
  const pl = searchParams.get("pl");

  return (
    <div className="min-h-screen bg-gradient-to-b from-amber-50 to-white flex items-center justify-center p-6">
      <div className="bg-white rounded-2xl shadow-lg border border-neutral-100 p-10 max-w-md w-full text-center" data-testid="payment-cancelled-card">
        <div className="w-16 h-16 rounded-full bg-amber-100 flex items-center justify-center mx-auto mb-6">
          <XCircle className="w-8 h-8 text-amber-600" />
        </div>
        <h1 className="text-2xl font-bold text-neutral-900 mb-2" data-testid="text-cancelled-title">
          Payment Cancelled
        </h1>
        <p className="text-sm text-neutral-500 mt-4">
          The payment was not completed. You can try again using the same link if it hasn&apos;t expired.
        </p>
        {pl && (
          <p className="text-xs text-neutral-400 mt-4">
            Reference: {pl}
          </p>
        )}
      </div>
    </div>
  );
}
