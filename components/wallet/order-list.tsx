"use client";

import { useState } from "react";
import { ShoppingCart, Package, DollarSign, ArrowDownLeft, ArrowUpRight, Truck, Eye, Clock, CheckCircle2, XCircle, RefreshCw, ExternalLink, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { StatusBadge } from "./status-badge";
import { useToast } from "@/hooks/use-toast";
import { authFetch } from "@/lib/auth-fetch";

export interface OrderRow {
  id: number;
  type: string;
  amount_display: string;
  balance_after_display: string | null;
  product_name: string | null;
  product_locator: string | null;
  quantity: number;
  order_status: string | null;
  status: string;
  crossmint_order_id: string | null;
  shipping_address: Record<string, string> | null;
  tracking_info: Record<string, string> | null;
  metadata?: {
    direction?: "inbound" | "outbound";
    counterparty_address?: string;
    [key: string]: any;
  } | null;
  created_at: string;
}

interface OrderListProps {
  orders: OrderRow[];
  onOrderUpdated?: (updated: OrderRow) => void;
  orderStatusEndpoint?: string;
  testIdPrefix?: string;
}

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

function OrderDetailDialog({ order, open, onOpenChange, onUpdated, statusEndpoint }: {
  order: OrderRow | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdated?: (updated: OrderRow) => void;
  statusEndpoint?: string;
}) {
  const { toast } = useToast();
  const [refreshing, setRefreshing] = useState(false);
  const [currentOrder, setCurrentOrder] = useState<OrderRow | null>(order);

  if (order && currentOrder?.id !== order.id) {
    setCurrentOrder(order);
  }

  const tx = currentOrder;

  const handleRefresh = async () => {
    if (!tx?.crossmint_order_id || !statusEndpoint) return;
    setRefreshing(true);
    try {
      const res = await authFetch(`${statusEndpoint}/${tx.crossmint_order_id}`);
      if (res.ok) {
        const data = await res.json();
        const updated: OrderRow = {
          ...tx,
          order_status: data.order.order_status,
          tracking_info: data.order.tracking_info,
          status: data.order.status,
        };
        setCurrentOrder(updated);
        onUpdated?.(updated);
        toast({ title: "Order status refreshed" });
      }
    } catch {
      toast({ title: "Failed to refresh order status", variant: "destructive" });
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg" data-testid="dialog-order-detail">
        <DialogTitle>Order Details</DialogTitle>
        <DialogDescription>
          {tx?.product_name || "Order"} — {tx?.amount_display}
        </DialogDescription>
        {tx && (
          <div className="space-y-4 mt-2">
            <OrderTimeline orderStatus={tx.order_status} />

            <div className="grid grid-cols-2 gap-3">
              <div className="bg-neutral-50 rounded-lg p-3">
                <p className="text-xs text-neutral-500">Amount</p>
                <p className="text-sm font-semibold text-neutral-900" data-testid="text-order-amount">{tx.amount_display}</p>
              </div>
              <div className="bg-neutral-50 rounded-lg p-3">
                <p className="text-xs text-neutral-500">Quantity</p>
                <p className="text-sm font-semibold text-neutral-900">{tx.quantity}</p>
              </div>
              <div className="bg-neutral-50 rounded-lg p-3">
                <p className="text-xs text-neutral-500">Status</p>
                <StatusBadge status={tx.status} />
              </div>
              <div className="bg-neutral-50 rounded-lg p-3">
                <p className="text-xs text-neutral-500">Order Status</p>
                <StatusBadge status={tx.order_status || "pending"} />
              </div>
            </div>

            {!tx.tracking_info && (!tx.product_locator || !tx.product_locator.startsWith("amazon:")) && tx.order_status && !["pending", "requires_approval"].includes(tx.order_status) && (
              <div className="bg-amber-50 border border-amber-100 rounded-lg p-3" data-testid="tracking-unavailable-note">
                <p className="text-xs text-amber-700">Package tracking is currently available for Amazon orders only. Check the merchant directly for shipping updates.</p>
              </div>
            )}

            {tx.tracking_info && (
              <div className="bg-indigo-50 border border-indigo-100 rounded-lg p-4" data-testid="tracking-info-section">
                <div className="flex items-center gap-2 mb-2">
                  <Truck className="w-4 h-4 text-indigo-600" />
                  <h4 className="text-sm font-semibold text-indigo-800">Tracking Information</h4>
                </div>
                <div className="space-y-1.5">
                  {tx.tracking_info.carrier && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-indigo-600">Carrier</span>
                      <span className="font-medium text-indigo-900">{tx.tracking_info.carrier}</span>
                    </div>
                  )}
                  {tx.tracking_info.tracking_number && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-indigo-600">Tracking #</span>
                      <span className="font-mono text-indigo-900">{tx.tracking_info.tracking_number}</span>
                    </div>
                  )}
                  {tx.tracking_info.estimated_delivery && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-indigo-600">Est. Delivery</span>
                      <span className="text-indigo-900">{tx.tracking_info.estimated_delivery}</span>
                    </div>
                  )}
                  {tx.tracking_info.tracking_url && (
                    <a
                      href={tx.tracking_info.tracking_url}
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

            {tx.shipping_address && (
              <div className="bg-neutral-50 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <MapPin className="w-4 h-4 text-neutral-500" />
                  <h4 className="text-sm font-semibold text-neutral-700">Shipping Address</h4>
                </div>
                <p className="text-sm text-neutral-600">
                  {Object.values(tx.shipping_address).filter(Boolean).join(", ")}
                </p>
              </div>
            )}

            {tx.crossmint_order_id && statusEndpoint && (
              <div className="flex items-center justify-between">
                <code className="text-xs text-neutral-400 font-mono" data-testid="text-crossmint-order-id">
                  Order: {tx.crossmint_order_id.slice(0, 12)}...
                </code>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleRefresh}
                  disabled={refreshing}
                  className="gap-1 text-violet-600 border-violet-200 hover:bg-violet-50"
                  data-testid="button-refresh-order"
                >
                  <RefreshCw className={`w-3 h-3 ${refreshing ? "animate-spin" : ""}`} />
                  Refresh Status
                </Button>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

export function OrderList({ orders, onOrderUpdated, orderStatusEndpoint, testIdPrefix = "order" }: OrderListProps) {
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailOrder, setDetailOrder] = useState<OrderRow | null>(null);

  const handleOpenDetail = (order: OrderRow) => {
    setDetailOrder(order);
    setDetailOpen(true);
  };

  if (orders.length === 0) {
    return (
      <div className="text-center py-16 bg-white rounded-xl border border-neutral-100" data-testid={`text-no-${testIdPrefix}s`}>
        <Package className="w-12 h-12 mx-auto text-neutral-300 mb-4" />
        <h3 className="text-lg font-semibold text-neutral-700">No orders yet</h3>
        <p className="text-sm text-neutral-500 mt-1">Orders will appear here when your bots make purchases</p>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-3">
        {orders.map((tx) => (
          <div
            key={tx.id}
            className="bg-white rounded-xl border border-neutral-100 p-4 cursor-pointer hover:border-violet-200 hover:shadow-sm transition-all"
            onClick={() => handleOpenDetail(tx)}
            data-testid={`${testIdPrefix}-card-${tx.id}`}
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
                {tx.tracking_info.carrier && <span>{tx.tracking_info.carrier}</span>}
                {tx.tracking_info.tracking_number && <span className="font-mono">{tx.tracking_info.tracking_number}</span>}
                {!tx.tracking_info.carrier && !tx.tracking_info.tracking_number && <span>Tracking info available</span>}
              </div>
            )}
          </div>
        ))}
      </div>

      <OrderDetailDialog
        order={detailOrder}
        open={detailOpen}
        onOpenChange={setDetailOpen}
        onUpdated={onOrderUpdated}
        statusEndpoint={orderStatusEndpoint}
      />
    </>
  );
}
