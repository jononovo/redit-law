import { DashboardTransactionLedger } from "@/components/dashboard/transaction-ledger";

export default function TransactionsPage() {
  return (
    <div className="flex flex-col gap-8 animate-fade-in-up">
      <div>
        <p className="text-neutral-500">View and filter all your transaction history.</p>
      </div>
      <DashboardTransactionLedger />
    </div>
  );
}
