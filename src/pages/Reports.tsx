import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { db } from '../db/db';
import { useLiveQuery } from 'dexie-react-hooks';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Printer, RefreshCcw } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export default function Reports() {
  const [activeTab, setActiveTab] = useState<'sales' | 'booker_summary'>('sales');

  return (
    <div className="space-y-6 print:space-y-0">
      <div className="flex space-x-2 border-b border-gray-200 print:hidden mb-4">
        <button
          className={`pb-2 px-4 text-sm font-medium ${activeTab === 'sales' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
          onClick={() => setActiveTab('sales')}
        >
          Sales & Profitability
        </button>
        <button
          className={`pb-2 px-4 text-sm font-medium ${activeTab === 'booker_summary' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
          onClick={() => setActiveTab('booker_summary')}
        >
          Order Booker Summary
        </button>
      </div>

      {activeTab === 'sales' && <SalesProfitabilityTab />}
      {activeTab === 'booker_summary' && <OrderBookerSummaryTab />}
    </div>
  );
}

function SalesProfitabilityTab() {
  const [fromDate, setFromDate] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 1);
    return d.toISOString().split('T')[0];
  });
  
  const [toDate, setToDate] = useState(() => new Date().toISOString().split('T')[0]);

  const invoicesData = useLiveQuery(() => db.salesInvoices.toArray());
  const itemsData = useLiveQuery(() => db.salesItems.toArray());
  const products = useLiveQuery(() => db.products.toArray());
  const profile = useLiveQuery(() => db.profile.get(1));

  const invoices = useMemo(() => {
    if (!invoicesData) return [];
    return invoicesData.filter(inv => inv.date >= fromDate && inv.date <= toDate);
  }, [invoicesData, fromDate, toDate]);

  const items = useMemo(() => {
    if (!itemsData || !invoices) return [];
    const invoiceIds = new Set(invoices.map(i => i.id));
    return itemsData.filter(item => invoiceIds.has(item.invoiceId));
  }, [itemsData, invoices]);

  const totalSalesThisPeriod = invoices.reduce((acc, inv) => acc + inv.total, 0);
  const totalStockValue = products?.reduce((acc, p) => acc + (p.stock * p.purchasePrice), 0) || 0;
  
  const approximateProfit = items.reduce((acc, item) => {
     const prod = products?.find(p => p.id === item.productId);
     if(!prod) return acc;
     const profitPerItem = item.price - prod.purchasePrice;
     return acc + (profitPerItem * item.qty);
  }, 0);

  // Group items to see top passing products
  const productSalesMap = new Map<number, {name: string, code: string, qty: number, revenue: number}>();
  items.forEach(item => {
     let existing = productSalesMap.get(item.productId);
     if(!existing) {
        existing = { name: item.productName, code: products?.find(p => p.id === item.productId)?.code || '', qty: 0, revenue: 0 };
        productSalesMap.set(item.productId, existing);
     }
     existing.qty += item.qty;
     existing.revenue += item.total;
  });
  const productSales = Array.from(productSalesMap.values()).sort((a,b) => b.revenue - a.revenue);

  return (
    <div className="space-y-6 print:block">
      
      {/* Header for print */}
      <div className="hidden print:block text-center border-b-2 border-gray-800 pb-4 mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-gray-900 uppercase">{profile?.name || 'SOBAN AGENCIES'}</h1>
        <p className="text-md font-medium mt-1">Sales & Profitability Report</p>
        <p className="text-sm text-gray-500">From: {fromDate} To: {toDate}</p>
      </div>

      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4 print:hidden">
         <div>
            <h2 className="text-xl font-bold tracking-tight text-gray-900">System Reports</h2>
            <p className="text-sm text-gray-500">Filter sales by date range to generate insights.</p>
         </div>
         <div className="flex gap-3 items-end bg-white p-3 rounded-md shadow-sm border border-gray-100">
            <div className="space-y-1">
               <Label className="text-xs">From Date</Label>
               <Input type="date" value={fromDate} onChange={e=>setFromDate(e.target.value)} className="h-8" />
            </div>
            <div className="space-y-1">
               <Label className="text-xs">To Date</Label>
               <Input type="date" value={toDate} onChange={e=>setToDate(e.target.value)} className="h-8" />
            </div>
            <Button variant="outline" size="sm" onClick={() => window.print()} className="h-8">
               <Printer className="w-4 h-4 mr-2" /> Print
            </Button>
         </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
         <Card className="shadow-sm print:shadow-none print:border-gray-300">
            <CardHeader className="print:p-3">
               <CardTitle className="text-sm text-gray-500 uppercase">Period Sales</CardTitle>
            </CardHeader>
            <CardContent className="print:p-3">
               <p className="text-3xl font-bold text-gray-900">Rs {totalSalesThisPeriod.toLocaleString()}</p>
            </CardContent>
         </Card>
         <Card className="shadow-sm print:shadow-none print:border-gray-300">
            <CardHeader className="print:p-3">
               <CardTitle className="text-sm text-gray-500 uppercase">Est. Gross Profit (Period)</CardTitle>
            </CardHeader>
            <CardContent className="print:p-3">
               <p className="text-3xl font-bold text-green-600">Rs {approximateProfit.toLocaleString()}</p>
               <p className="text-xs text-gray-500 mt-1">Based on avg. cost prices</p>
            </CardContent>
         </Card>
         <Card className="shadow-sm print:shadow-none print:border-gray-300">
            <CardHeader className="print:p-3">
               <CardTitle className="text-sm text-gray-500 uppercase">Current Total Stock Val.</CardTitle>
            </CardHeader>
            <CardContent className="print:p-3">
               <p className="text-3xl font-bold text-gray-900">Rs {totalStockValue.toLocaleString()}</p>
            </CardContent>
         </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
         <Card className="shadow-sm print:shadow-none print:border-gray-300">
           <CardHeader>
              <CardTitle className="text-base text-gray-800">Sales by Product</CardTitle>
           </CardHeader>
           <CardContent className="p-0">
              <div className="max-h-[400px] overflow-auto print:max-h-none print:overflow-visible">
                 <table className="w-full text-sm text-left">
                    <thead className="bg-gray-50 text-gray-500 sticky top-0">
                       <tr>
                          <th className="px-4 py-3 font-medium border-b border-gray-200">Product</th>
                          <th className="px-4 py-3 font-medium border-b border-gray-200 text-right">Qty Sold</th>
                          <th className="px-4 py-3 font-medium border-b border-gray-200 text-right">Revenue</th>
                       </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                       {productSales.slice(0, 50).map((ps, idx) => (
                          <tr key={idx}>
                             <td className="px-4 py-3">
                               <p className="font-medium text-gray-900">{ps.name}</p>
                               <p className="text-xs font-mono text-gray-500">{ps.code}</p>
                             </td>
                             <td className="px-4 py-3 text-right font-medium">{ps.qty}</td>
                             <td className="px-4 py-3 text-right text-gray-600">Rs {ps.revenue.toLocaleString()}</td>
                          </tr>
                       ))}
                       {productSales.length === 0 && (
                          <tr><td colSpan={3} className="p-8 text-center text-gray-500 italic">No sales data in this period.</td></tr>
                       )}
                    </tbody>
                 </table>
              </div>
           </CardContent>
         </Card>

         <Card className="shadow-sm print:shadow-none print:border-gray-300">
           <CardHeader>
              <CardTitle className="text-base">Invoices Overview</CardTitle>
           </CardHeader>
           <CardContent className="p-0">
              <div className="max-h-[400px] overflow-auto print:max-h-none print:overflow-visible">
                 <table className="w-full text-sm text-left">
                    <thead className="bg-gray-50 text-gray-500 sticky top-0">
                       <tr>
                          <th className="px-4 py-3 font-medium border-b border-gray-200">Date</th>
                          <th className="px-4 py-3 font-medium border-b border-gray-200">INV #</th>
                          <th className="px-4 py-3 font-medium border-b border-gray-200">Customer</th>
                          <th className="px-4 py-3 font-medium border-b border-gray-200 text-right">Total</th>
                       </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                       {invoices?.slice().reverse().map(inv => {
                          return (
                             <tr key={inv.id}>
                                <td className="px-4 py-3 text-gray-600">{inv.date}</td>
                                <td className="px-4 py-3 font-mono text-xs text-blue-600">INV-{inv.id}</td>
                                <td className="px-4 py-3 text-gray-900">{inv.customerName}</td>
                                <td className="px-4 py-3 text-right font-medium">Rs {inv.total.toFixed(2)}</td>
                             </tr>
                          )
                       })}
                       {!invoices?.length && (
                          <tr><td colSpan={4} className="p-8 text-center text-gray-500 italic">No sales recorded yet.</td></tr>
                       )}
                    </tbody>
                 </table>
              </div>
           </CardContent>
         </Card>
      </div>

    </div>
  );
}

function OrderBookerSummaryTab() {
  const profile = useLiveQuery(() => db.profile.get(1));
  const employees = useLiveQuery(() => db.employees.where('role').equals('order_booker').toArray());
  const [date, setDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [selectedBookerId, setSelectedBookerId] = useState<string>('');
  
  const invoicesData = useLiveQuery(() => db.salesInvoices.where('date').equals(date).toArray(), [date]);
  const itemsData = useLiveQuery(() => db.salesItems.toArray());
  const products = useLiveQuery(() => db.products.toArray());

  const invoices = useMemo(() => {
    if (!invoicesData || !selectedBookerId) return [];
    return invoicesData.filter(inv => inv.orderBookerId === parseInt(selectedBookerId));
  }, [invoicesData, selectedBookerId]);

  const items = useMemo(() => {
    if (!itemsData || !invoices) return [];
    const invoiceIds = new Set(invoices.map(i => i.id));
    return itemsData.filter(item => invoiceIds.has(item.invoiceId));
  }, [itemsData, invoices]);

  // Consolidated product list
  const consolidatedProducts = useMemo(() => {
    const map = new Map<number, {name: string, cartonQty: number, pieceQty: number, totalPieces: number}>();
    items.forEach(item => {
      let existing = map.get(item.productId);
      if (!existing) {
        existing = { name: item.productName, cartonQty: 0, pieceQty: 0, totalPieces: 0 };
        map.set(item.productId, existing);
      }
      existing.cartonQty += item.cartonQty || 0;
      existing.pieceQty += item.pieceQty || 0;
      existing.totalPieces += item.qty || 0;
    });
    return Array.from(map.values()).sort((a,b) => b.totalPieces - a.totalPieces);
  }, [items]);

  const totalSales = invoices.reduce((acc, inv) => acc + inv.total, 0);
  const booker = employees?.find(e => e.id?.toString() === selectedBookerId);

  return (
    <div className="space-y-6 print:block">
      {/* Controls */}
      <div className="flex flex-col sm:flex-row gap-4 items-end bg-white p-4 rounded-md shadow-sm border border-gray-100 print:hidden">
        <div className="space-y-1.5 w-full sm:w-64">
           <Label className="text-xs font-semibold">Select Order Booker</Label>
           <Select value={selectedBookerId} onValueChange={setSelectedBookerId}>
              <SelectTrigger className="h-9">
                 <SelectValue placeholder="Select booker..." />
              </SelectTrigger>
              <SelectContent>
                 {employees?.map(e => (
                    <SelectItem key={e.id} value={e.id!.toString()}>{e.name}</SelectItem>
                 ))}
              </SelectContent>
           </Select>
        </div>
        <div className="space-y-1.5 w-full sm:w-48">
           <Label className="text-xs font-semibold">Select Date</Label>
           <Input type="date" value={date} onChange={e => setDate(e.target.value)} className="h-9" />
        </div>
        <Button variant="outline" className="h-9" onClick={() => window.print()} disabled={!selectedBookerId}>
           <Printer className="w-4 h-4 mr-2" /> Print Summary
        </Button>
      </div>

      {/* Print Header */}
      <div className="hidden print:block text-center border-b-2 border-gray-800 pb-4 mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-gray-900 uppercase">{profile?.name || 'SOBAN AGENCIES'}</h1>
        <h2 className="text-xl font-medium mt-1">Order Booker Summary</h2>
        <div className="flex justify-between items-end mt-4">
           <div className="text-left text-sm font-semibold text-gray-800">
             <p>Booker: <span className="text-lg">{booker?.name || 'N/A'}</span></p>
           </div>
           <div className="text-right text-sm">
             <p>Date: {date}</p>
             <p>Total Orders: {invoices.length}</p>
           </div>
        </div>
      </div>

      {!selectedBookerId ? (
        <div className="p-12 text-center text-gray-400 border-2 border-dashed border-gray-200 rounded-lg print:hidden">
           Please select an Order Booker to view the summary.
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 print:block print:space-y-8">
           
           {/* Consolidated Product List (Load Sheet) */}
           <div className="space-y-3">
              <h3 className="text-lg font-bold border-b border-gray-200 pb-2">Consolidated Product Load Sheet</h3>
              <table className="w-full text-sm border-collapse bg-white">
                 <thead>
                    <tr className="bg-gray-50/80 border border-gray-200">
                       <th className="py-2 px-3 text-left font-semibold border border-gray-200">Product Name</th>
                       <th className="py-2 px-3 text-center font-semibold border border-gray-200 w-16">CTN</th>
                       <th className="py-2 px-3 text-center font-semibold border border-gray-200 w-16">PCS</th>
                       <th className="py-2 px-3 text-center font-semibold border border-gray-200 w-16">Total PCS</th>
                    </tr>
                 </thead>
                 <tbody>
                    {consolidatedProducts.map((p, idx) => {
                       const prodMeta = products?.find(pr => pr.name === p.name);
                       const ppc = prodMeta?.piecesPerCarton || 1;
                       const looseTotal = p.totalPieces;
                       const ctn = Math.floor(looseTotal / ppc);
                       const pcs = looseTotal % ppc;
                       
                       return (
                          <tr key={idx} className="border border-gray-200">
                             <td className="py-2 px-3 border border-gray-200 font-medium text-gray-900">{p.name}</td>
                             <td className="py-2 px-3 text-center border border-gray-200 bg-gray-50/30">{ctn > 0 ? ctn : '-'}</td>
                             <td className="py-2 px-3 text-center border border-gray-200">{pcs > 0 ? pcs.toFixed(2) : '-'}</td>
                             <td className="py-2 px-3 text-center border border-gray-200 font-bold bg-blue-50/30">{p.totalPieces.toFixed(2)}</td>
                          </tr>
                       )
                    })}
                    {consolidatedProducts.length === 0 && (
                       <tr><td colSpan={4} className="py-8 text-center text-gray-500 italic border border-gray-200">No products ordered by this booker today.</td></tr>
                    )}
                 </tbody>
              </table>
           </div>

           {/* Invoices (Shops visited) */}
           <div className="space-y-3">
              <h3 className="text-lg font-bold border-b border-gray-200 pb-2">Shops (Orders)</h3>
              <table className="w-full text-sm border-collapse bg-white">
                 <thead>
                    <tr className="bg-gray-50/80 border border-gray-200">
                       <th className="py-2 px-3 text-left font-semibold border border-gray-200 w-20">INV #</th>
                       <th className="py-2 px-3 text-left font-semibold border border-gray-200">Shop Name</th>
                       <th className="py-2 px-3 text-right font-semibold border border-gray-200 w-28">Total Amount</th>
                    </tr>
                 </thead>
                 <tbody>
                    {invoices.map((inv, idx) => (
                       <tr key={idx} className="border border-gray-200">
                          <td className="py-2 px-3 border border-gray-200 font-mono text-xs text-blue-600">INV-{inv.id}</td>
                          <td className="py-2 px-3 border border-gray-200 font-semibold text-gray-900">{inv.customerName}</td>
                          <td className="py-2 px-3 text-right border border-gray-200 font-bold">Rs {inv.total.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                       </tr>
                    ))}
                    {invoices.length > 0 && (
                       <tr className="bg-gray-900 text-white font-bold border border-gray-900">
                          <td colSpan={2} className="py-3 px-3 text-right uppercase tracking-wider text-xs">Total Booker Value:</td>
                          <td className="py-3 px-3 text-right text-base">Rs {totalSales.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                       </tr>
                    )}
                    {invoices.length === 0 && (
                       <tr><td colSpan={3} className="py-8 text-center text-gray-500 italic border border-gray-200">No invoices generated by this booker today.</td></tr>
                    )}
                 </tbody>
              </table>
           </div>

        </div>
      )}
    </div>
  );
}
