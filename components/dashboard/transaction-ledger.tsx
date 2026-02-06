import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ArrowDownLeft, Server, ShoppingBag, Zap } from "lucide-react";

const transactions = [
  {
    id: "tx_1",
    merchant: "OpenAI API",
    logo: "https://upload.wikimedia.org/wikipedia/commons/4/4d/OpenAI_Logo.svg",
    category: "Infrastructure",
    date: "Today, 2:45 PM",
    amount: "-$24.00",
    status: "pending",
    type: "expense",
    icon: Server
  },
  {
    id: "tx_2",
    merchant: "Vercel Pro",
    logo: "https://assets.vercel.com/image/upload/front/favicon/vercel/180x180.png",
    category: "Infrastructure",
    date: "Yesterday, 9:00 AM",
    amount: "-$20.00",
    status: "completed",
    type: "expense",
    icon: Zap
  },
  {
    id: "tx_3",
    merchant: "Stripe Payout",
    logo: null,
    category: "Income",
    date: "Feb 04, 2026",
    amount: "+$1,250.00",
    status: "completed",
    type: "income",
    icon: ArrowDownLeft
  },
  {
    id: "tx_4",
    merchant: "AWS Route53",
    logo: null,
    category: "Infrastructure",
    date: "Feb 02, 2026",
    amount: "-$12.50",
    status: "completed",
    type: "expense",
    icon: Server
  },
  {
    id: "tx_5",
    merchant: "Midjourney",
    logo: null,
    category: "Services",
    date: "Feb 01, 2026",
    amount: "-$30.00",
    status: "completed",
    type: "expense",
    icon: ShoppingBag
  }
];

export function DashboardTransactionLedger() {
  return (
    <div className="rounded-xl border border-neutral-100 bg-white overflow-hidden shadow-sm">
      <div className="p-6 border-b border-neutral-100 flex items-center justify-between">
        <h3 className="font-bold text-lg text-neutral-900">Recent Transactions</h3>
        <Badge variant="secondary" className="bg-neutral-100 text-neutral-600 hover:bg-neutral-200">View All</Badge>
      </div>
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent bg-neutral-50/50">
            <TableHead className="w-[300px]">Merchant</TableHead>
            <TableHead>Category</TableHead>
            <TableHead>Date</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Amount</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {transactions.map((tx) => (
            <TableRow key={tx.id} className="hover:bg-neutral-50/50">
              <TableCell className="font-medium">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-neutral-50 border border-neutral-100 flex items-center justify-center">
                    {tx.logo ? (
                       <Avatar className="h-6 w-6">
                            <AvatarImage src={tx.logo} />
                            <AvatarFallback><tx.icon className="w-4 h-4 text-neutral-500" /></AvatarFallback>
                       </Avatar>
                    ) : (
                        <tx.icon className="w-4 h-4 text-neutral-500" />
                    )}
                  </div>
                  <span className="text-neutral-900">{tx.merchant}</span>
                </div>
              </TableCell>
              <TableCell className="text-neutral-500">{tx.category}</TableCell>
              <TableCell className="text-neutral-500">{tx.date}</TableCell>
              <TableCell>
                <Badge 
                    variant="outline" 
                    className={
                        tx.status === "pending" 
                        ? "bg-yellow-50 text-yellow-700 border-yellow-200" 
                        : "bg-green-50 text-green-700 border-green-200"
                    }
                >
                    {tx.status}
                </Badge>
              </TableCell>
              <TableCell className={`text-right font-mono font-medium ${tx.type === 'income' ? 'text-green-600' : 'text-neutral-900'}`}>
                {tx.amount}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
