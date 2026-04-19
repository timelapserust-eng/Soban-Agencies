import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { db } from '../db/db';
import { useLiveQuery } from 'dexie-react-hooks';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { motion } from 'motion/react';
import { ArrowUpRight, TrendingUp, Users, PackageOpen, CreditCard } from 'lucide-react';

function isWithinRange(dateStr: string, range: string) {
  if (range === 'all') return true;
  
  const d = new Date(dateStr);
  const now = new Date();
  
  // Set times to midnight for precise day matching
  now.setHours(0, 0, 0, 0);
  const checkDate = new Date(d);
  checkDate.setHours(0, 0, 0, 0);

  if (range === 'today') {
     return checkDate.getTime() === now.getTime();
  }
  
  if (range === 'week') {
     const weekAgo = new Date(now);
     weekAgo.setDate(now.getDate() - 7);
     return checkDate >= weekAgo && checkDate <= now;
  }
  
  if (range === 'month') {
     const monthAgo = new Date(now);
     monthAgo.setMonth(now.getMonth() - 1);
     return checkDate >= monthAgo && checkDate <= now;
  }

  if (range === 'year') {
     const yearAgo = new Date(now);
     yearAgo.setFullYear(now.getFullYear() - 1);
     return checkDate >= yearAgo && checkDate <= now;
  }

  return true;
}

export default function Dashboard() {
  const [dateFilter, setDateFilter] = useState<string>('all');
  
  const products = useLiveQuery(() => db.products.toArray());
  const customers = useLiveQuery(() => db.customers.toArray());
  const allInvoices = useLiveQuery(() => db.salesInvoices.toArray());
  const allLedgers = useLiveQuery(() => db.ledger.toArray());

  const invoices = allInvoices?.filter(inv => isWithinRange(inv.date, dateFilter)) || [];
  
  const totalSales = invoices.reduce((acc, inv) => acc + inv.total, 0);
  
  // Only count direct recovery cash inside the range
  const recoveries = allLedgers?.filter(l => l.type === 'credit' && l.description === 'Cash received' && isWithinRange(l.date, dateFilter)).reduce((acc, l) => acc + l.amount, 0) || 0;

  const totalReceivables = customers?.reduce((acc, cus) => acc + (cus.balance > 0 ? cus.balance : 0), 0) || 0;

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex justify-between items-center bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
         <div>
            <h2 className="text-xl font-bold text-gray-900 tracking-tight">System Overview</h2>
            <p className="text-sm text-gray-500 mt-1">Monitor your distribution network performance</p>
         </div>
         <div className="w-48">
            <Select value={dateFilter} onValueChange={setDateFilter}>
               <SelectTrigger className="bg-gray-50/50 border-gray-200">
                  <SelectValue placeholder="Filter by date..." />
               </SelectTrigger>
               <SelectContent>
                  <SelectItem value="today">Today</SelectItem>
                  <SelectItem value="week">Past 7 Days</SelectItem>
                  <SelectItem value="month">Past 30 Days</SelectItem>
                  <SelectItem value="year">Past Year</SelectItem>
                  <SelectItem value="all">All Time</SelectItem>
               </SelectContent>
            </Select>
         </div>
      </motion.div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatsCard title="Total Sales" value={`Rs ${totalSales.toLocaleString(undefined, {minimumFractionDigits: 2})}`} subtitle={dateFilter !== 'all' ? `Filtered by selection` : 'All time'} icon={<TrendingUp className="h-5 w-5 text-blue-600"/>} trend="+12.5%" delay={0.1} />
        <StatsCard title="Recoveries" value={`Rs ${recoveries.toLocaleString(undefined, {minimumFractionDigits: 2})}`} subtitle="Cash received (Filtered)" icon={<CreditCard className="h-5 w-5 text-emerald-600"/>} delay={0.2} />
        <StatsCard title="Total Receivables" value={`Rs ${totalReceivables.toLocaleString(undefined, {minimumFractionDigits: 2})}`} subtitle="Current market pending" icon={<ArrowUpRight className="h-5 w-5 text-amber-600"/>} delay={0.3} />
        <StatsCard title="Total Customers" value={customers?.length.toString() || '0'} subtitle="Registered entities" icon={<Users className="h-5 w-5 text-purple-600"/>} delay={0.4} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}>
        <Card className="shadow-sm rounded-2xl border-gray-100 overflow-hidden h-full">
          <CardHeader className="bg-red-50/30 border-b border-red-100/50">
            <CardTitle className="text-red-900 flex items-center gap-2">
              <PackageOpen className="w-5 h-5 text-red-500" /> Low Stock Alerts
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-gray-100/50 text-gray-500">
                  <tr>
                    <th className="px-4 py-2 font-medium">Code</th>
                    <th className="px-4 py-2 font-medium">Product Name</th>
                    <th className="px-4 py-2 font-medium text-right">Stock</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {products?.filter(p => p.stock < 10).slice(0, 5).map(p => (
                     <tr key={p.id}>
                       <td className="px-4 py-2 font-mono text-xs text-gray-500">{p.code}</td>
                       <td className="px-4 py-2">{p.name}</td>
                       <td className="px-4 py-2 text-right font-medium text-red-600">{p.stock}</td>
                     </tr>
                  ))}
                  {products?.filter(p => p.stock < 10).length === 0 && (
                    <tr><td colSpan={3} className="px-4 py-4 text-center text-gray-500 text-sm">No low stock items</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }}>
        <Card className="shadow-sm rounded-2xl border-gray-100 h-full">
          <CardHeader className="border-b border-gray-50">
            <CardTitle className="text-gray-900">Recent Sales Invoices</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-gray-100/50 text-gray-500">
                  <tr>
                    <th className="px-4 py-2 font-medium">Inv #</th>
                    <th className="px-4 py-2 font-medium">Date</th>
                    <th className="px-4 py-2 font-medium">Customer</th>
                    <th className="px-4 py-2 font-medium text-right">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {invoices?.slice(-5).reverse().map(inv => (
                     <tr key={inv.id}>
                       <td className="px-4 py-2 font-mono text-xs">INV-{inv.id}</td>
                       <td className="px-4 py-2 text-gray-500">{inv.date}</td>
                       <td className="px-4 py-2">{inv.customerName}</td>
                       <td className="px-4 py-2 text-right font-medium">Rs {inv.total.toLocaleString()}</td>
                     </tr>
                  ))}
                  {!invoices?.length && (
                    <tr><td colSpan={4} className="px-4 py-4 text-center text-gray-500 text-sm">No invoices yet</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
        </motion.div>
      </div>
    </div>
  );
}

function StatsCard({ title, value, subtitle, icon, trend, delay }: { title: string, value: string, subtitle?: string, icon?: React.ReactNode, trend?: string, delay: number }) {
  return (
    <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.4, delay: delay, ease: [0.23, 1, 0.32, 1] }}>
    <Card className="shadow-sm border border-gray-100 bg-white rounded-2xl overflow-hidden relative group">
      <div className="absolute inset-0 bg-gradient-to-br from-gray-50/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"/>
      <CardContent className="p-6">
        <div className="flex justify-between items-start">
           <div className="text-xs font-bold text-gray-500 uppercase tracking-widest">{title}</div>
           {icon && <div className="p-2 bg-gray-50 rounded-lg group-hover:scale-110 transition-transform duration-300">{icon}</div>}
        </div>
        <div className="text-3xl font-bold mt-4 text-gray-900 tracking-tight">{value}</div>
        <div className="flex items-center gap-2 mt-2">
           {trend && <span className="text-xs font-semibold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded">{trend}</span>}
           {subtitle && <div className="text-xs text-gray-400">{subtitle}</div>}
        </div>
      </CardContent>
    </Card>
    </motion.div>
  );
}
