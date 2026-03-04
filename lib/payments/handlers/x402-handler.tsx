"use client";

import { useState, useCallback } from "react";
import { Copy, Check, ArrowLeft, Terminal, Wallet, Globe, Hash } from "lucide-react";
import type { PaymentHandlerProps } from "../types";

function CopyButton({ text, label }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      const textarea = document.createElement("textarea");
      textarea.value = text;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [text]);

  return (
    <button
      onClick={handleCopy}
      className="flex items-center gap-1.5 text-xs font-medium text-neutral-500 hover:text-[#E8735A] transition-colors cursor-pointer"
      data-testid={`button-copy-${label || "text"}`}
    >
      {copied ? (
        <>
          <Check className="w-3.5 h-3.5 text-green-500" />
          <span className="text-green-500">Copied</span>
        </>
      ) : (
        <>
          <Copy className="w-3.5 h-3.5" />
          <span>Copy</span>
        </>
      )}
    </button>
  );
}

export function X402Handler({ context, onCancel }: PaymentHandlerProps) {
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const checkoutId = context.checkoutPageId || "";

  const requirementsUrl = `${origin}/api/v1/checkout/${checkoutId}/x402`;
  const payUrl = `${origin}/api/v1/checkout/${checkoutId}/pay/x402`;

  const amountDisplay = context.amountUsd
    ? `$${context.amountUsd.toFixed(2)}`
    : "Any amount";

  const amountUsdc = context.amountUsd
    ? Math.round(context.amountUsd * 1_000_000)
    : null;

  const snippet = `// 1. Build the x402 payment payload
const payload = {
  from: "YOUR_WALLET_ADDRESS",
  to: "${context.walletAddress}",${amountUsdc ? `\n  value: "${amountUsdc}",` : "\n  value: \"AMOUNT_IN_USDC_ATOMIC\", // 1 USDC = 1000000"}
  validAfter: 0,
  validBefore: Math.floor(Date.now() / 1000) + 3600,
  nonce: "0x" + crypto.randomUUID().replace(/-/g, "").padEnd(64, "0"),
  chainId: 8453,
  token: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
  signature: "SIGNED_VIA_EIP3009"
};

// 2. Base64-encode and send as X-PAYMENT header
const header = btoa(JSON.stringify(payload));

const res = await fetch("${payUrl}", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "X-PAYMENT": header
  },
  body: JSON.stringify({})
});

const result = await res.json();
console.log(result);
// { status: "confirmed", sale_id: "sale_...", tx_hash: "0x...", amount_usd: ${context.amountUsd?.toFixed(2) || "..."} }`;

  const curlSnippet = `curl -X POST "${payUrl}" \\
  -H "Content-Type: application/json" \\
  -H "X-PAYMENT: <base64-encoded-payment-payload>" \\
  -d '{}'`;

  return (
    <div className="w-full" data-testid="x402-handler">
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={onCancel}
          className="flex items-center justify-center w-8 h-8 rounded-lg hover:bg-neutral-100 transition-colors cursor-pointer"
          data-testid="button-x402-back"
        >
          <ArrowLeft className="w-4 h-4 text-neutral-600" />
        </button>
        <div>
          <h3 className="text-lg font-bold text-neutral-900">Agent Pay (x402)</h3>
          <p className="text-xs text-neutral-500">Share these details with your AI agent</p>
        </div>
      </div>

      <div className="space-y-4">
        <div className="bg-neutral-50 rounded-xl border border-neutral-200 p-4 space-y-3">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2 text-sm font-semibold text-neutral-700">
              <Globe className="w-4 h-4" />
              Endpoints
            </div>
          </div>
          <div className="space-y-2">
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-neutral-400">Requirements (discover)</span>
                <CopyButton text={requirementsUrl} label="requirements-url" />
              </div>
              <code
                className="block text-xs font-mono text-neutral-600 bg-white rounded-lg px-3 py-2 border border-neutral-200 break-all"
                data-testid="text-x402-requirements-endpoint"
              >
                GET {requirementsUrl}
              </code>
            </div>
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-neutral-400">Pay (settle)</span>
                <CopyButton text={payUrl} label="endpoint" />
              </div>
              <code
                className="block text-xs font-mono text-neutral-600 bg-white rounded-lg px-3 py-2 border border-neutral-200 break-all"
                data-testid="text-x402-endpoint"
              >
                POST {payUrl}
              </code>
            </div>
          </div>
        </div>

        <div className="bg-neutral-50 rounded-xl border border-neutral-200 p-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-neutral-700 mb-3">
            <Hash className="w-4 h-4" />
            Payment Requirements
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <span className="text-xs text-neutral-400 block mb-1">Amount</span>
              <span className="text-sm font-bold text-neutral-900" data-testid="text-x402-amount">
                {amountDisplay}
              </span>
            </div>
            <div>
              <span className="text-xs text-neutral-400 block mb-1">Network</span>
              <span className="text-sm font-bold text-neutral-900" data-testid="text-x402-network">Base</span>
            </div>
            <div>
              <span className="text-xs text-neutral-400 block mb-1">Token</span>
              <span className="text-sm font-bold text-neutral-900" data-testid="text-x402-token">USDC</span>
            </div>
            <div>
              <span className="text-xs text-neutral-400 block mb-1">Protocol</span>
              <span className="text-sm font-bold text-neutral-900" data-testid="text-x402-protocol">EIP-3009</span>
            </div>
          </div>

          <div className="mt-3 pt-3 border-t border-neutral-200">
            <div className="flex items-start justify-between mb-1">
              <span className="text-xs text-neutral-400">Recipient Wallet</span>
              <CopyButton text={context.walletAddress} label="wallet" />
            </div>
            <code
              className="block text-xs font-mono text-neutral-600 bg-white rounded-lg px-3 py-2 border border-neutral-200 break-all"
              data-testid="text-x402-wallet"
            >
              {context.walletAddress}
            </code>
          </div>
        </div>

        <div className="bg-neutral-50 rounded-xl border border-neutral-200 p-4">
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-neutral-700">
              <Terminal className="w-4 h-4" />
              Code Example
            </div>
            <CopyButton text={snippet} label="snippet" />
          </div>
          <pre
            className="text-xs font-mono text-neutral-600 bg-white rounded-lg px-3 py-3 border border-neutral-200 overflow-x-auto whitespace-pre leading-relaxed"
            data-testid="text-x402-snippet"
          >
            {snippet}
          </pre>
        </div>

        <div className="bg-neutral-50 rounded-xl border border-neutral-200 p-4">
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-neutral-700">
              <Terminal className="w-4 h-4" />
              cURL
            </div>
            <CopyButton text={curlSnippet} label="curl" />
          </div>
          <pre
            className="text-xs font-mono text-neutral-600 bg-white rounded-lg px-3 py-3 border border-neutral-200 overflow-x-auto whitespace-pre leading-relaxed"
            data-testid="text-x402-curl"
          >
            {curlSnippet}
          </pre>
        </div>

        <div className="flex items-center justify-center gap-2 pt-2">
          <Wallet className="w-3.5 h-3.5 text-neutral-400" />
          <p className="text-xs text-neutral-400">
            x402 uses EIP-3009 transferWithAuthorization on Base
          </p>
        </div>
      </div>
    </div>
  );
}
