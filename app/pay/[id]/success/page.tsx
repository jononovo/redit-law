"use client";

import { useEffect, useState, Suspense } from "react";
import { useParams } from "next/navigation";
import { CheckCircle, Loader2, ExternalLink, Mail } from "lucide-react";
import Image from "next/image";

interface CheckoutData {
  checkout_page_id: string;
  title: string;
  description: string | null;
  success_url: string | null;
  success_message: string | null;
}

function SuccessContent() {
  const params = useParams();
  const id = params.id as string;
  const [data, setData] = useState<CheckoutData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!id) {
      setLoading(false);
      return;
    }
    fetch(`/api/v1/checkout/${id}/public`)
      .then((res) => (res.ok ? res.json() : null))
      .then((d) => {
        if (d) setData(d);
        else setError(true);
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-neutral-400" data-testid="loading-spinner" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-green-50 to-white flex flex-col">
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="bg-white rounded-2xl shadow-lg border border-neutral-100 p-10 max-w-md w-full text-center" data-testid="checkout-success-card">
          <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-6" data-testid="icon-success-check">
            <CheckCircle className="w-8 h-8 text-green-600" />
          </div>

          <h1 className="text-2xl font-bold text-neutral-900 mb-2" data-testid="text-payment-successful">
            Payment Successful
          </h1>

          {data?.success_message ? (
            <p className="text-neutral-600 font-medium mt-4 leading-relaxed" data-testid="text-success-message">
              {data.success_message}
            </p>
          ) : (
            <p className="text-neutral-500 mt-4" data-testid="text-default-message">
              Your payment has been received and is being processed. The funds will settle as USDC on Base.
            </p>
          )}

          {data?.title && (
            <div className="mt-6 p-4 rounded-xl bg-neutral-50 border border-neutral-100" data-testid="checkout-details">
              <p className="text-sm text-neutral-400 mb-1">Paid to</p>
              <p className="font-semibold text-neutral-900" data-testid="text-checkout-title">{data.title}</p>
              {data.description && (
                <p className="text-sm text-neutral-500 mt-1" data-testid="text-checkout-description">{data.description}</p>
              )}
            </div>
          )}

          <div className="mt-8 space-y-3">
            {data?.success_url && (
              <a
                href={data.success_url}
                className="inline-flex items-center justify-center gap-2 w-full px-6 py-3 rounded-xl bg-neutral-900 text-white font-semibold hover:bg-neutral-800 transition-colors"
                data-testid="link-return-seller"
              >
                Return to seller
                <ExternalLink size={16} />
              </a>
            )}

            <a
              href="mailto:"
              className="inline-flex items-center justify-center gap-2 w-full px-6 py-3 rounded-xl bg-neutral-100 text-neutral-700 font-semibold hover:bg-neutral-200 transition-colors"
              data-testid="link-contact-seller"
            >
              <Mail size={16} />
              Contact seller
            </a>
          </div>

          {error && !data && (
            <p className="text-sm text-neutral-400 mt-6" data-testid="text-error-fallback">
              Payment confirmed. You can safely close this page.
            </p>
          )}
        </div>
      </div>

      <footer className="py-6 text-center" data-testid="footer-branding">
        <div className="flex items-center justify-center gap-2 mb-2">
          <Image
            src="/images/logo-claw-chip.png"
            alt="CreditClaw"
            width={20}
            height={20}
            className="opacity-60"
          />
          <span className="text-sm font-semibold text-neutral-400">
            Powered by CreditClaw
          </span>
        </div>
        <p className="text-xs text-neutral-400">
          Payments settle as USDC on Base
        </p>
      </footer>
    </div>
  );
}

export default function CheckoutSuccessPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-b from-green-50 to-white flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-neutral-400" />
      </div>
    }>
      <SuccessContent />
    </Suspense>
  );
}
