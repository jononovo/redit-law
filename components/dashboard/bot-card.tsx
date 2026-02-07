"use client";

import { Bot, Clock, CheckCircle } from "lucide-react";

interface BotCardProps {
  botName: string;
  botId: string;
  description?: string | null;
  walletStatus: string;
  createdAt: string;
  claimedAt?: string | null;
}

export function BotCard({ botName, botId, description, walletStatus, createdAt, claimedAt }: BotCardProps) {
  const isActive = walletStatus === "active";

  return (
    <div
      className="bg-white rounded-2xl border border-neutral-100 shadow-sm p-6 hover:shadow-md transition-shadow"
      data-testid={`bot-card-${botId}`}
    >
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isActive ? "bg-green-50" : "bg-neutral-100"}`}>
            <Bot className={`w-5 h-5 ${isActive ? "text-green-600" : "text-neutral-400"}`} />
          </div>
          <div>
            <h3 className="font-bold text-neutral-900">{botName}</h3>
            <p className="text-xs text-neutral-400 font-mono">{botId}</p>
          </div>
        </div>
        <span
          className={`inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1 rounded-full ${
            isActive
              ? "bg-green-50 text-green-700"
              : "bg-amber-50 text-amber-700"
          }`}
          data-testid={`status-${botId}`}
        >
          {isActive ? <CheckCircle className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
          {isActive ? "Active" : "Pending"}
        </span>
      </div>

      {description && (
        <p className="text-sm text-neutral-500 mb-4 line-clamp-2">{description}</p>
      )}

      <div className="flex items-center gap-4 text-xs text-neutral-400">
        <span>Registered {new Date(createdAt).toLocaleDateString()}</span>
        {claimedAt && (
          <span>Claimed {new Date(claimedAt).toLocaleDateString()}</span>
        )}
      </div>
    </div>
  );
}
