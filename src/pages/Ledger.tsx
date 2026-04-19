import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { db } from '../db/db';
import { useLiveQuery } from 'dexie-react-hooks';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Check, ChevronsUpDown } from 'lucide-react';
import { toast } from 'sonner';

export default function Ledger() {
  const [activeTab, setActiveTab] = useState<'customer' | 'recovery'>('customer');

  return (
    <div className="space-y-6">
      <div className="flex space-x-2 border-b border-gray-200">
        <button
          className={`pb-2 px-4 text-sm font-medium ${activeTab === 'customer' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
          onClick={() => setActiveTab('customer')}
        >
          Customer Ledger
        </button>
        <button
          className={`pb-2 px-4 text-sm font-medium ${activeTab === 'recovery' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
          onClick={() => setActiveTab('recovery')}
        >
          Recovery Entry
        </button>
      </div>

      {activeTab === 'customer' && <CustomerLedgerTab />}
      {activeTab === 'recovery' && <RecoveryTab />}
    </div>
  );
}

function CustomerLedgerTab() {
  const customers = useLiveQuery(() => db.customers.toArray());
  const bookers = useLiveQuery(() => db.employees.where('role').equals('order_booker').toArray());
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('all');
  const [selectedBookerId, setSelectedBookerId] = useState<string>('all');
  
  const entries = useLiveQuery(async () => {
    let query = db.ledger.where('entityType').equals('customer');
    
    if (selectedCustomerId !== 'all' && selectedCustomerId) {
      query = db.ledger.where('entityId').equals(parseInt(selectedCustomerId));
    }
    
    let result = await query.reverse().sortBy('date');
    
    // In-memory filter for entityType (if where clause changed) and booker
    result = result.filter(l => l.entityType === 'customer');
    
    if (selectedBookerId !== 'all' && selectedBookerId) {
       result = result.filter(l => l.orderBookerId === parseInt(selectedBookerId));
    }
    
    return result;
  }, [selectedCustomerId, selectedBookerId]);

  const selectedCustomerInfo = customers?.find(c => c.id?.toString() === selectedCustomerId);
  
  // Calculate specific totals if filtered by Booker
  const bookerDebit = entries?.filter(e => e.type === 'debit').reduce((acc, curr) => acc + curr.amount, 0) || 0;
  const bookerCredit = entries?.filter(e => e.type === 'credit').reduce((acc, curr) => acc + curr.amount, 0) || 0;

  return (
    <div className="space-y-4">
       <div className="flex flex-wrap gap-4 items-end print:hidden">
        <div className="w-64 space-y-2">
          <Label>Select Customer</Label>
          <Select value={selectedCustomerId} onValueChange={setSelectedCustomerId}>
             <SelectTrigger className="bg-white">
                <SelectValue placeholder="All Customers" />
             </SelectTrigger>
             <SelectContent>
                <SelectItem value="all">All Customers</SelectItem>
                {customers?.map(c => (
                   <SelectItem key={c.id} value={c.id!.toString()}>{c.name}</SelectItem>
                ))}
             </SelectContent>
          </Select>
        </div>

        <div className="w-64 space-y-2">
          <Label>Filter by Order Booker</Label>
          <Select value={selectedBookerId} onValueChange={setSelectedBookerId}>
             <SelectTrigger className="bg-white">
                <SelectValue placeholder="All Bookers" />
             </SelectTrigger>
             <SelectContent>
                <SelectItem value="all">All Bookers / System</SelectItem>
                {bookers?.map(b => (
                   <SelectItem key={b.id} value={b.id!.toString()}>{b.name}</SelectItem>
                ))}
             </SelectContent>
          </Select>
        </div>

        {selectedCustomerInfo && selectedBookerId === 'all' && (
           <div className="ml-auto flex gap-6 p-4 bg-white rounded shadow-sm border border-gray-100">
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-widest">Current Balance</p>
                <p className={`text-xl font-bold ${selectedCustomerInfo.balance > 0 ? 'text-green-600' : 'text-red-600'}`}>
                  Rs {Math.abs(selectedCustomerInfo.balance).toFixed(2)}
                  <span className="text-sm font-normal ml-1 text-gray-500">
                    {selectedCustomerInfo.balance > 0 ? 'Dr (Receivable)' : selectedCustomerInfo.balance < 0 ? 'Cr (Payable)' : ''}
                  </span>
                </p>
              </div>
           </div>
        )}
        
        {selectedBookerId !== 'all' && (
           <div className="ml-auto flex gap-6 p-4 bg-white rounded shadow-sm border border-blue-100 bg-blue-50/30">
              <div>
                <p className="text-xs text-blue-500 uppercase tracking-widest">Booker Billed (Dr)</p>
                <p className="text-xl font-bold text-blue-700">Rs {bookerDebit.toFixed(2)}</p>
              </div>
              <div className="border-l border-blue-200 pl-6">
                <p className="text-xs text-blue-500 uppercase tracking-widest">Booker Collected (Cr)</p>
                <p className="text-xl font-bold text-green-700">Rs {bookerCredit.toFixed(2)}</p>
              </div>
           </div>
        )}
        
        <Button variant="outline" className="ml-auto" onClick={() => window.print()}>Print Ledger</Button>
      </div>

      <Card className="shadow-sm print:shadow-none print:border-none print:w-full">
        <CardContent className="p-0">
          <div className="hidden print:block mb-6 border-b-2 border-gray-800 pb-4">
             <h1 className="text-2xl font-bold uppercase">Customer Ledger Report</h1>
             <p className="text-sm mt-1">{selectedCustomerId === 'all' ? 'All Customers' : selectedCustomerInfo?.name}</p>
             <p className="text-xs text-gray-500">Date: {new Date().toLocaleDateString()}</p>
             {selectedBookerId !== 'all' && <p className="text-xs text-blue-600 mt-1">Filtered by Booker: {bookers?.find(b => b.id?.toString() === selectedBookerId)?.name}</p>}
          </div>
          <table className="w-full text-sm text-left">
            <thead className="bg-gray-100/50 text-gray-500 print:bg-transparent border-b-2 border-gray-800">
              <tr>
                <th className="px-4 py-3 font-semibold text-gray-700">Date</th>
                {selectedCustomerId === 'all' && <th className="px-4 py-3 font-semibold text-gray-700">Customer ID</th>}
                <th className="px-4 py-3 font-semibold text-gray-700">Description</th>
                <th className="px-4 py-3 font-semibold text-gray-700 text-right">Debit (Dr)</th>
                <th className="px-4 py-3 font-semibold text-gray-700 text-right">Credit (Cr)</th>
                <th className="px-4 py-3 font-semibold text-gray-700 text-right">Balance</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 bg-white">
              {entries?.map(e => (
                 <tr key={e.id} className="hover:bg-gray-50 transition-colors">
                   <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{e.date}</td>
                   {selectedCustomerId === 'all' && <td className="px-4 py-3">Cust #{e.entityId}</td>}
                   <td className="px-4 py-3 text-gray-800">{e.description}</td>
                   <td className="px-4 py-3 text-right text-green-600 tabular-nums font-medium">
                     {e.type === 'debit' ? e.amount.toFixed(2) : '-'}
                   </td>
                   <td className="px-4 py-3 text-right text-red-600 tabular-nums font-medium">
                     {e.type === 'credit' ? e.amount.toFixed(2) : '-'}
                   </td>
                   <td className="px-4 py-3 text-right tabular-nums text-gray-500 font-mono text-xs">
                     {Math.abs(e.balanceAfter).toFixed(2)} {e.balanceAfter > 0 ? 'Dr' : e.balanceAfter < 0 ? 'Cr' : ''}
                   </td>
                 </tr>
              ))}
              {!entries?.length && (
                 <tr>
                    <td colSpan={selectedCustomerId === 'all' ? 6 : 5} className="p-8 text-center text-gray-500 italic">No ledger entries found.</td>
                 </tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}

function RecoveryTab() {
  const customers = useLiveQuery(() => db.customers.toArray());
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');
  const [customerOpen, setCustomerOpen] = useState(false);
  const [amount, setAmount] = useState<number>(0);
  const [desc, setDesc] = useState<string>('Cash received');

  const selectedCustomer = customers?.find(c => c.id?.toString() === selectedCustomerId);

  const handleSaveRecovery = async () => {
    if(!selectedCustomerId || amount <= 0) {
      toast.error('Select customer and enter valid amount.');
      return;
    }

    const customer = await db.customers.get(parseInt(selectedCustomerId));
    if(!customer) return;

    try {
      await db.transaction('rw', db.customers, db.ledger, async () => {
         const newBalance = customer.balance - amount;
         await db.customers.update(customer.id!, { balance: newBalance });
         await db.ledger.add({
           date: new Date().toISOString().split('T')[0],
           entityType: 'customer',
           entityId: customer.id!,
           type: 'credit',
           amount: amount,
           description: desc,
           balanceAfter: newBalance,
           orderBookerId: customer.linkedBookerId
         });
      });
      toast.success('Recovery saved successfully!');
      setAmount(0);
      setDesc('Cash received');
      setSelectedCustomerId('');
    } catch (e) {
      console.error(e);
      toast.error('Failed to save recovery');
    }
  };

  return (
    <div className="flex gap-6 max-w-4xl">
      <Card className="w-full md:w-1/2 shadow-sm border-none">
        <CardHeader>
           <CardTitle>Cash Recovery Entry</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
           <div className="space-y-2">
              <Label>Search Customer</Label>
              <Popover open={customerOpen} onOpenChange={setCustomerOpen}>
                 <PopoverTrigger asChild>
                   <Button variant="outline" role="combobox" aria-expanded={customerOpen} className="justify-between w-full">
                     {selectedCustomerId ? selectedCustomer?.name : "Select customer..."}
                     <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                   </Button>
                 </PopoverTrigger>
                 <PopoverContent className="w-full p-0">
                   <Command>
                     <CommandInput placeholder="Search customer (name)..." />
                     <CommandList>
                       <CommandEmpty>No customer found.</CommandEmpty>
                       <CommandGroup>
                         {customers?.map((c) => (
                           <CommandItem
                             key={c.id}
                             value={c.name}
                             onSelect={() => {
                               setSelectedCustomerId(c.id!.toString());
                               setCustomerOpen(false);
                             }}
                           >
                             <Check className={`mr-2 h-4 w-4 ${selectedCustomerId === c.id?.toString() ? "opacity-100" : "opacity-0"}`} />
                             {c.name}
                           </CommandItem>
                         ))}
                       </CommandGroup>
                     </CommandList>
                   </Command>
                 </PopoverContent>
              </Popover>
           </div>
           
           <div className="space-y-2">
              <Label>Amount Received (Rs)</Label>
              <Input type="number" min="0" value={amount} onChange={e => setAmount(parseFloat(e.target.value)||0)} className="bg-white" />
           </div>
           <div className="space-y-2">
              <Label>Description / Remarks</Label>
              <Input value={desc} onChange={e => setDesc(e.target.value)} className="bg-white" />
           </div>
           <Button onClick={handleSaveRecovery} className="w-full bg-green-600 hover:bg-green-700 text-white mt-4">Save Recovery</Button>
        </CardContent>
      </Card>

      {/* Balance Summary Box */}
      {selectedCustomer && (
         <Card className="w-full md:w-1/2 shadow-sm border border-gray-200 bg-gray-50/50">
            <CardHeader>
               <CardTitle className="text-lg">Balance Overview</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 pt-2">
               <div>
                  <p className="text-sm text-gray-500 font-medium">Customer</p>
                  <p className="text-lg font-bold text-gray-900">{selectedCustomer.name}</p>
               </div>
               <div className="pt-2 border-t border-gray-200">
                 <p className="text-sm text-gray-500 font-medium pt-1">Previous Outstanding Balance (Dr)</p>
                 <p className="text-2xl font-bold font-mono tracking-tight text-gray-900">
                    Rs {selectedCustomer.balance.toLocaleString(undefined, {minimumFractionDigits: 2})}
                 </p>
               </div>
               {amount > 0 && (
               <div className="pt-2 border-t border-gray-200">
                 <p className="text-sm text-gray-500 font-medium pt-1">Remaining Balance After Recovery</p>
                 <p className="text-2xl font-bold font-mono tracking-tight text-blue-600">
                    Rs {(selectedCustomer.balance - amount).toLocaleString(undefined, {minimumFractionDigits: 2})}
                 </p>
               </div>
               )}
            </CardContent>
         </Card>
      )}
    </div>
  );
}
