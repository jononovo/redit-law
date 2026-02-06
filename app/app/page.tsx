"use client";

import { CardVisual } from "@/components/dashboard/card-visual";
import { DashboardTransactionLedger } from "@/components/dashboard/transaction-ledger";
import { ArrowUpRight, ArrowDownLeft, Wallet } from "lucide-react";

function StatCard({ label, value, trend, trendUp }: { label: string, value: string, trend: string, trendUp?: boolean }) {
  return (
    <div className="bg-white p-6 rounded-xl border border-neutral-100 shadow-sm flex flex-col gap-4 hover:shadow-md transition-shadow" data-testid={`stat-${label.toLowerCase().replace(/\s/g, '-')}`}>
      <div className="flex justify-between items-start">
        <span className="text-sm font-medium text-neutral-500">{label}</span>
        <div className={`p-2 rounded-lg ${trendUp ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'}`}>
            {trendUp ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownLeft className="w-4 h-4" />}
        </div>
      </div>
      <div>
        <h3 className="text-2xl font-bold text-neutral-900 tracking-tight">{value}</h3>
        <p className={`text-xs font-medium mt-1 ${trendUp ? 'text-green-600' : 'text-red-600'}`}>
            {trend} <span className="text-neutral-400 font-normal">vs last month</span>
        </p>
      </div>
    </div>
  );
}

export default function DashboardOverview() {
  return (
    <div className="flex flex-col gap-8 animate-fade-in-up">
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <StatCard label="Total Balance" value="$12,450.00" trend="+12%" trendUp={true} />
          <StatCard label="Monthly Spend" value="$3,240.50" trend="+5%" trendUp={false} />
          <StatCard label="Active Cards" value="3 Active" trend="+1" trendUp={true} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          <div className="lg:col-span-1 flex flex-col gap-6">
              <div className="flex items-center justify-between">
                  <h3 className="font-bold text-lg text-neutral-900">My Cards</h3>
                  <button className="text-sm font-medium text-primary hover:text-primary/80" data-testid="link-view-all-cards">View All</button>
              </div>
              
              <CardVisual className="w-full shadow-2xl shadow-primary/20" />
              
              <div className="bg-neutral-900 text-white p-6 rounded-2xl flex items-center justify-between relative overflow-hidden group cursor-pointer" data-testid="card-add-funds">
                  <div className="absolute inset-0 bg-gradient-to-r from-primary/20 to-purple-500/20 opacity-0 group-hover:opacity-100 transition-opacity" />
                  <div className="relative z-10">
                      <h4 className="font-bold">Add Funds</h4>
                      <p className="text-sm text-neutral-400">Top up your balance instantly</p>
                  </div>
                  <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center relative z-10 group-hover:bg-white/20 transition-colors">
                      <Wallet className="w-5 h-5 text-white" />
                  </div>
              </div>
          </div>

          <div className="lg:col-span-2">
              <DashboardTransactionLedger />
          </div>

      </div>

    </div>
  );
}
