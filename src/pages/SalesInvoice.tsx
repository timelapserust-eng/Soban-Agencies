import { useState, useRef, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { db, Product, Customer } from '../db/db';
import { useLiveQuery } from 'dexie-react-hooks';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { toast } from 'sonner';
import { Check, ChevronsUpDown, Trash2, Printer, Pencil } from 'lucide-react';

interface CartItem {
  product: Product;
  cartonQty: number;
  pieceQty: number;
  totalPieces: number;
  tradeRate: number; // Price per piece
  discountRate: number; // percentage
  total: number;
}

export default function SalesInvoice() {
  const [activeTab, setActiveTab] = useState<'create' | 'history'>('create');

  return (
    <div className="space-y-6">
      <div className="flex space-x-2 border-b border-gray-200 print:hidden">
        <button
          className={`pb-2 px-4 text-sm font-medium ${activeTab === 'create' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
          onClick={() => setActiveTab('create')}
        >
          Create Invoice
        </button>
        <button
          className={`pb-2 px-4 text-sm font-medium ${activeTab === 'history' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
          onClick={() => setActiveTab('history')}
        >
          Manage Invoices
        </button>
      </div>

      {activeTab === 'create' && <CreateInvoiceTab onSwitchTab={(tab) => setActiveTab(tab)} />}
      {activeTab === 'history' && <ManageInvoicesTab />}
    </div>
  );
}

function CreateInvoiceTab({ onSwitchTab }: { onSwitchTab: (tab: 'create' | 'history') => void }) {
  const profile = useLiveQuery(() => db.profile.get(1));
  const products = useLiveQuery(() => db.products.toArray());
  const customers = useLiveQuery(() => db.customers.toArray());
  const bookers = useLiveQuery(() => db.employees.where('role').equals('order_booker').toArray());
  
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');
  const [customerOpen, setCustomerOpen] = useState(false);

  const [selectedBookerId, setSelectedBookerId] = useState<string>('');

  const [selectedProductId, setSelectedProductId] = useState<string>('');
  const [productOpen, setProductOpen] = useState(false);

  const [cart, setCart] = useState<CartItem[]>([]);
  const [discountFixed, setDiscountFixed] = useState<number>(0);
  const [discountPercentage, setDiscountPercentage] = useState<number>(0);
  const [freight, setFreight] = useState<number>(0);

  // Auto calculation
  const subTotal = cart.reduce((acc, item) => acc + item.total, 0);
  
  // Base total adds freight
  const baseTotal = subTotal + freight;
  
  // Calculate percentage discount value implicitly off the subtotal
  const computedPercentageDisc = subTotal * (discountPercentage / 100);
  
  // Total discounts combined
  const discountValue = discountFixed + computedPercentageDisc;
  
  const finalTotal = baseTotal - discountValue;

  const [cartonQty, setCartonQty] = useState<number>(0);
  const [pieceQty, setPieceQty] = useState<number>(0);
  const [looseQty, setLooseQty] = useState<number>(0);
  const [itemDiscount, setItemDiscount] = useState<number>(0);
  const qtyInputRef = useRef<HTMLInputElement>(null);

  const selectedCustomer = customers?.find(c => c.id?.toString() === selectedCustomerId);
  const previousBalance = selectedCustomer ? selectedCustomer.balance : 0;
  const grandTotal = finalTotal + previousBalance;

  const handleAddToCart = () => {
    if (!selectedProductId) return;
    const product = products?.find(p => p.id?.toString() === selectedProductId);
    if (!product) return;
    
    // total pieces calculation
    const ppc = product.piecesPerCarton || 1;
    const loosePerTotal = product.itemsPerPiece || 1;
    // Fraction of a piece. (e.g. 1 loose out of 40 = 0.025 piece)
    const totalPieces = (cartonQty * ppc) + pieceQty + (looseQty / loosePerTotal);

    if (totalPieces <= 0) {
      toast.error('Enter valid quantity');
      return;
    }

    if (product.stock < totalPieces) {
      toast.error(`Insufficient stock! Only ${product.stock} pieces left.`);
      return;
    }

    const tradeRate = product.salePrice;
    const grossTotal = totalPieces * tradeRate;
    const itemTotalAfterDiscount = grossTotal - (grossTotal * (itemDiscount / 100));

    const existingItemIndex = cart.findIndex(i => i.product.id === product.id);
    if (existingItemIndex >= 0) {
       const newCart = [...cart];
       const newTotalPieces = newCart[existingItemIndex].totalPieces + totalPieces;
       if (product.stock < newTotalPieces) {
         toast.error(`Insufficient stock!`);
         return;
       }
       newCart[existingItemIndex].cartonQty += cartonQty;
       newCart[existingItemIndex].pieceQty += pieceQty;
       newCart[existingItemIndex].looseQty = (newCart[existingItemIndex].looseQty || 0) + looseQty;
       newCart[existingItemIndex].totalPieces = newTotalPieces;
       newCart[existingItemIndex].discountRate = itemDiscount; // update discount
       
       const newGross = newTotalPieces * tradeRate;
       newCart[existingItemIndex].total = newGross - (newGross * (itemDiscount/100));
       
       setCart(newCart);
    } else {
       setCart([...cart, {
         product,
         cartonQty,
         pieceQty,
         looseQty,
         totalPieces,
         tradeRate,
         discountRate: itemDiscount,
         total: itemTotalAfterDiscount
       }]);
    }
    
    setSelectedProductId('');
    setCartonQty(0);
    setPieceQty(0);
    setLooseQty(0);
    setItemDiscount(0);
    toast.success('Added to invoice');
  };

  const removeFromCart = (index: number) => {
    setCart(cart.filter((_, i) => i !== index));
  };

  const updateCartItem = (index: number, field: 'cartonQty' | 'pieceQty' | 'tradeRate' | 'discountRate', value: number) => {
    const newCart = [...cart];
    const item = newCart[index];
    item[field] = value;
    
    // Recalculate total pieces
    const ppc = item.product.piecesPerCarton || 1;
    const loosePerTotal = item.product.itemsPerPiece || 1;
    item.totalPieces = (item.cartonQty * ppc) + item.pieceQty + ((item.looseQty || 0) / loosePerTotal);
    
    // Recalculate total amount
    const grossTotal = item.totalPieces * item.tradeRate;
    item.total = grossTotal - (grossTotal * (item.discountRate / 100));
    
    setCart(newCart);
  };

  const handleSaveInvoice = async () => {
    if(!selectedCustomerId) {
       toast.error('Please select a customer');
       return;
    }
    if(cart.length === 0) {
       toast.error('Invoice is empty');
       return;
    }

    const customer = customers?.find(c => c.id?.toString() === selectedCustomerId);
    if(!customer) return;

    try {
      await db.transaction('rw', [db.salesInvoices, db.salesItems, db.products, db.customers, db.ledger], async () => {
        // 1. Save Invoice
        const invoiceId = await db.salesInvoices.add({
          date: new Date().toISOString().split('T')[0],
          customerId: customer.id!,
          customerName: customer.name,
          orderBookerId: selectedBookerId ? parseInt(selectedBookerId) : undefined,
          subTotal,
          freight,
          discountFixed,
          discountPercentage,
          discountValue,
          bilty: 0,
          previousBalance: previousBalance,
          total: finalTotal,
          isSynced: false
        });

        // 2. Save Items and Deduct Stock
        for (const item of cart) {
          await db.salesItems.add({
            invoiceId,
            productId: item.product.id!,
            productName: item.product.name,
            cartonQty: item.cartonQty,
            pieceQty: item.pieceQty,
            looseQty: item.looseQty,
            qty: item.totalPieces,
            tradeRate: item.tradeRate,
            price: item.tradeRate, // fallback for schema
            discountRate: item.discountRate,
            total: item.total
          });
          
          const p = await db.products.get(item.product.id!);
          if(p) {
             await db.products.update(p.id!, { stock: p.stock - item.totalPieces });
          }
        }

        // 3. Update Customer Balance
        await db.customers.update(customer.id!, { balance: customer.balance + finalTotal });

        // 4. Ledger Entry
        await db.ledger.add({
          date: new Date().toISOString().split('T')[0],
          entityType: 'customer',
          entityId: customer.id!,
          type: 'debit',
          amount: finalTotal,
          description: `Sales Invoice #${invoiceId}`,
          balanceAfter: customer.balance + finalTotal,
          orderBookerId: selectedBookerId ? parseInt(selectedBookerId) : undefined
        });
      });

      toast.success('Invoice saved successfully!');
      // Reset
      setCart([]);
      setSelectedCustomerId('');
      setDiscountValue(0);
      setFreight(0);
      onSwitchTab('history');
      
    } catch (e) {
      console.error(e);
      toast.error('Error saving invoice');
    }
  };

  const handlePrint = () => {
     window.print();
  };

  return (
    <div className="flex flex-col lg:flex-row gap-6 print:block">
      {/* Entry Panel (Hide in print) */}
      <div className="w-full lg:w-1/3 space-y-4 print:hidden">
        <Card className="shadow-sm">
          <CardHeader className="pb-3">
             <CardTitle className="text-base font-semibold text-gray-800">Invoice Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
             <div className="space-y-1.5 flex flex-col">
               <Label className="text-xs">Search Customer</Label>
               <Popover open={customerOpen} onOpenChange={setCustomerOpen}>
                 <PopoverTrigger asChild>
                   <Button variant="outline" role="combobox" aria-expanded={customerOpen} className="justify-between w-full h-9">
                     {selectedCustomerId ? customers?.find((c) => c.id?.toString() === selectedCustomerId)?.name : "Select customer..."}
                     <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                   </Button>
                 </PopoverTrigger>
                 <PopoverContent className="w-full p-0">
                   <Command>
                     <CommandInput placeholder="Search customer..." />
                     <CommandList>
                       <CommandEmpty>No customer found.</CommandEmpty>
                       <CommandGroup>
                         {customers?.map((customer) => (
                           <CommandItem
                             key={customer.id}
                             value={customer.name}
                             onSelect={(currentValue) => {
                               setSelectedCustomerId(customer.id!.toString());
                               if (customer.linkedBookerId && customer.linkedBookerId !== parseInt(selectedBookerId)) {
                                  setSelectedBookerId(customer.linkedBookerId.toString());
                               }
                               setCustomerOpen(false);
                             }}
                           >
                             <Check className={`mr-2 h-4 w-4 ${selectedCustomerId === customer.id?.toString() ? "opacity-100" : "opacity-0"}`} />
                             {customer.name} ({customer.type})
                           </CommandItem>
                         ))}
                       </CommandGroup>
                     </CommandList>
                   </Command>
                 </PopoverContent>
               </Popover>
             </div>
             
             <div className="space-y-1.5 flex flex-col">
                <Label className="text-xs">Order Booker (Optional)</Label>
                <Select value={selectedBookerId} onValueChange={setSelectedBookerId}>
                   <SelectTrigger className="h-9 bg-white"><SelectValue placeholder="Select booker..."/></SelectTrigger>
                   <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      {bookers?.map(b => (
                         <SelectItem key={b.id} value={b.id!.toString()}>{b.name}</SelectItem>
                      ))}
                   </SelectContent>
                </Select>
             </div>

             <div className="space-y-1.5 pt-2 border-t border-gray-100 flex flex-col">
                <Label className="text-xs">Search Product</Label>
                <Popover open={productOpen} onOpenChange={setProductOpen}>
                 <PopoverTrigger asChild>
                   <Button variant="outline" role="combobox" aria-expanded={productOpen} className="justify-between w-full h-9">
                     {selectedProductId ? products?.find((p) => p.id?.toString() === selectedProductId)?.name : "Select product..."}
                     <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                   </Button>
                 </PopoverTrigger>
                 <PopoverContent className="w-full p-0">
                   <Command>
                     <CommandInput placeholder="Search product code or name..." />
                     <CommandList>
                       <CommandEmpty>No product found.</CommandEmpty>
                       <CommandGroup>
                         {products?.filter(p => p.stock > 0).map((product) => (
                           <CommandItem
                             key={product.id}
                             value={`${product.code} ${product.name}`}
                             onSelect={(currentValue) => {
                               setSelectedProductId(product.id!.toString());
                               setProductOpen(false);
                               qtyInputRef.current?.focus();
                             }}
                           >
                             <Check className={`mr-2 h-4 w-4 ${selectedProductId === product.id?.toString() ? "opacity-100" : "opacity-0"}`} />
                             {product.name} ({product.code}) - Stock: {product.stock}
                           </CommandItem>
                         ))}
                       </CommandGroup>
                     </CommandList>
                   </Command>
                 </PopoverContent>
               </Popover>
                
                <div className="grid grid-cols-3 gap-2 mt-2">
                   <div className="space-y-1">
                      <Label className="text-xs">Cartons</Label>
                      <Input 
                         ref={qtyInputRef}
                         type="number" 
                         value={cartonQty} 
                         onChange={e => setCartonQty(parseInt(e.target.value) || 0)} 
                         min={0}
                         className="h-9" 
                       />
                   </div>
                   <div className="space-y-1">
                      <Label className="text-xs">Pieces</Label>
                      <Input 
                         type="number" 
                         value={pieceQty} 
                         onChange={e => setPieceQty(parseInt(e.target.value) || 0)} 
                         min={0}
                         className="h-9" 
                       />
                   </div>
                   <div className="space-y-1">
                      <Label className="text-xs">Disc %</Label>
                      <Input 
                         type="number" 
                         value={itemDiscount} 
                         onChange={e => setItemDiscount(parseFloat(e.target.value) || 0)} 
                         min={0}
                         className="h-9" 
                       />
                   </div>
                </div>
                <Button onClick={handleAddToCart} className="w-full h-9 mt-1 bg-blue-600 hover:bg-blue-700">Add Entry</Button>
             </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm bg-gray-50/50">
          <CardContent className="pt-4 space-y-4">
             <div className="grid grid-cols-2 gap-3 mt-4 border-t border-gray-100 pt-4">
                <div className="space-y-1.5">
                   <Label className="text-xs">Freight / Cargo (Rs)</Label>
                   <Input type="number" min="0" value={freight} onChange={e => setFreight(parseFloat(e.target.value) || 0)} className="h-9"/>
                </div>
                <div></div>
                <div className="space-y-1.5">
                   <Label className="text-xs">Fixed Discount (Rs)</Label>
                   <Input type="number" min="0" value={discountFixed} onChange={e => setDiscountFixed(parseFloat(e.target.value) || 0)} className="h-9"/>
                </div>
                <div className="space-y-1.5">
                   <Label className="text-xs">Percentage Discount (%)</Label>
                   <Input type="number" min="0" max="100" value={discountPercentage} onChange={e => setDiscountPercentage(parseFloat(e.target.value) || 0)} className="h-9"/>
                </div>
             </div>
          </CardContent>
        </Card>

        <div className="flex gap-3 pt-2">
           <Button className="flex-1" variant="outline" onClick={handlePrint}>Print Preview</Button>
           <Button className="flex-1 bg-green-600 hover:bg-green-700 text-white" onClick={handleSaveInvoice}>Save Invoice</Button>
        </div>
      </div>

      {/* Invoice Document / Preview */}
      <div className="w-full lg:w-2/3 bg-white border border-gray-200 rounded-sm shadow-sm print:border-none print:shadow-none print:w-full">
         <div className="p-8 print:p-0">
            {/* Header */}
            <div className="border-b-2 border-gray-800 pb-4 mb-6 flex justify-between items-end">
               <div>
                 <h1 className="text-2xl font-bold tracking-tight text-gray-900 uppercase">{profile?.name || 'SOBAN AGENCIES'}</h1>
                 {profile?.tagline && <p className="text-sm tracking-widest text-gray-500 mt-1 uppercase">{profile.tagline}</p>}
                 <p className="text-xs text-gray-600 mt-2 whitespace-pre-line">
                   {profile?.address || 'Main Bazaar, City Center' }
                   {"\n"}Phone: {profile?.phone || '(+92) 300 1234567'}
                   {profile?.ownerContact && `\nOwner: ${profile.ownerContact}`}
                 </p>
               </div>
               <div className="text-right">
                 <h2 className="text-3xl font-light text-gray-400 tracking-wider">INVOICE</h2>
                 <p className="text-sm font-medium mt-1">Date: {new Date().toLocaleDateString()}</p>
                 <p className="text-xs text-gray-500">Draft</p>
               </div>
            </div>

            {/* Bill To */}
            <div className="mb-6 flex justify-between items-start gap-4">
               <div>
                  <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Bill To</h3>
                  {selectedCustomerId ? (
                     <div className="bg-gray-50/50 p-4 rounded-lg border border-gray-100 min-w-[250px]">
                        <p className="font-bold text-lg text-gray-900">{customers?.find(c => c.id?.toString() === selectedCustomerId)?.name}</p>
                        <p className="text-sm text-gray-600 mt-1">{customers?.find(c => c.id?.toString() === selectedCustomerId)?.address || 'No Address Provided'}</p>
                        <p className="text-sm text-gray-600">Ph: {customers?.find(c => c.id?.toString() === selectedCustomerId)?.phone || '-'}</p>
                        {selectedBookerId && selectedBookerId !== 'none' && (
                           <div className="mt-3 pt-3 border-t border-gray-200">
                             <p className="text-xs text-gray-500 uppercase tracking-wider">Order Booker</p>
                             <p className="font-semibold text-sm text-gray-800">{bookers?.find(b => b.id?.toString() === selectedBookerId)?.name}</p>
                           </div>
                        )}
                     </div>
                  ) : (
                     <div className="text-sm text-gray-400 italic">Select a customer...</div>
                  )}
               </div>
               <div className="flex justify-end items-center mt-6">
                  <div className="w-56 text-right p-4 rounded-xl border border-blue-100 bg-blue-50/50 shadow-sm">
                     <p className="text-xs font-bold text-blue-600/70 uppercase tracking-widest mb-1">Amount Due</p>
                     <p className="text-2xl font-bold text-blue-900 tracking-tight">Rs {finalTotal.toLocaleString(undefined, {minimumFractionDigits: 2})}</p>
                  </div>
               </div>
            </div>

            {/* Items Table - Premium Minimalist approach */}
            <div className="rounded-xl border border-gray-200 overflow-hidden mt-8">
               <table className="w-full text-sm border-collapse bg-white">
                  <thead>
                     <tr className="bg-gray-50/80 border-b border-gray-200 text-gray-700">
                        <th className="py-3 px-4 text-left font-semibold">Item Description</th>
                        <th className="py-3 px-2 text-center font-semibold w-16">CTN</th>
                        <th className="py-3 px-2 text-center font-semibold w-16">PCS</th>
                        <th className="py-3 px-3 text-right font-semibold w-24">T.Rate</th>
                        <th className="py-3 px-3 text-right font-semibold w-20">Disc %</th>
                        <th className="py-3 px-4 text-right font-semibold w-32">Amount</th>
                        <th className="py-3 px-2 text-center w-10 print:hidden"></th>
                     </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                     {cart.map((item, idx) => (
                        <tr key={idx} className="group hover:bg-gray-50/50 transition-colors">
                           <td className="py-4 px-4">
                              <p className="font-semibold text-gray-900">{item.product.name}</p>
                              <p className="text-xs font-mono text-gray-400 mt-0.5">{item.product.code} <span className="opacity-70">(1x{item.product.piecesPerCarton || 1})</span></p>
                           </td>
                           <td className="py-2 px-2 text-center bg-gray-50/30">
                              <Input 
                                type="number" 
                                className="w-16 h-8 text-center px-1" 
                                min={0}
                                value={item.cartonQty} 
                                onChange={(e) => updateCartItem(idx, 'cartonQty', parseInt(e.target.value) || 0)} 
                              />
                           </td>
                           <td className="py-2 px-2 text-center">
                              <Input 
                                type="number" 
                                className="w-16 h-8 text-center px-1" 
                                min={0}
                                value={item.pieceQty} 
                                onChange={(e) => updateCartItem(idx, 'pieceQty', parseInt(e.target.value) || 0)} 
                              />
                           </td>
                           <td className="py-2 px-2 text-right tabular-nums font-mono">
                              <Input 
                                type="number" 
                                className="w-20 h-8 text-right px-1 float-right" 
                                min={0}
                                value={item.tradeRate} 
                                onChange={(e) => updateCartItem(idx, 'tradeRate', parseFloat(e.target.value) || 0)} 
                              />
                           </td>
                           <td className="py-2 px-2 text-right tabular-nums">
                             <div className="flex items-center justify-end gap-1">
                              <Input 
                                type="number" 
                                className="w-16 h-8 text-right px-1 text-red-500" 
                                min={0}
                                value={item.discountRate} 
                                onChange={(e) => updateCartItem(idx, 'discountRate', parseFloat(e.target.value) || 0)} 
                              />
                              <span className="text-gray-400 text-xs">%</span>
                             </div>
                           </td>
                           <td className="py-4 px-4 text-right tabular-nums font-bold text-gray-900">{item.total.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                           <td className="py-4 px-2 text-right print:hidden opacity-0 group-hover:opacity-100 transition-opacity">
                              <button onClick={()=>removeFromCart(idx)} className="text-red-500 hover:text-red-700 hover:bg-red-50 p-1.5 rounded-md transition-colors">
                                <Trash2 className="w-4 h-4" />
                              </button>
                           </td>
                        </tr>
                     ))}
                     {cart.length === 0 && (
                        <tr>
                           <td colSpan={7} className="py-12 text-center text-gray-400 italic">No items added to invoice. Start by scanning or searching above.</td>
                        </tr>
                     )}
                  </tbody>
               </table>
            </div>

            {/* Totals Section */}
            <div className="mt-8 flex justify-end">
               <div className="w-80 space-y-3 text-sm">
                  <div className="flex justify-between items-center text-gray-500">
                     <span>Subtotal:</span>
                     <span className="tabular-nums font-mono">Rs {subTotal.toLocaleString(undefined, {minimumFractionDigits:2})}</span>
                  </div>
                  {(discountValue > 0) && (
                     <div className="flex justify-between items-center text-red-500 bg-red-50/30 p-1.5 -mx-1.5 rounded">
                        <span>Invoice Disc:</span>
                        <span className="tabular-nums font-mono">- Rs {discountValue.toLocaleString(undefined, {minimumFractionDigits:2})}</span>
                     </div>
                  )}
                  {(freight > 0) && (
                     <div className="flex justify-between items-center text-gray-500">
                        <span>Freight/Cargo:</span>
                        <span className="tabular-nums font-mono">+ Rs {freight.toLocaleString(undefined, {minimumFractionDigits:2})}</span>
                     </div>
                  )}
                  <div className="flex justify-between items-center font-bold text-gray-800 text-base mt-2 border-t border-gray-200 pt-3">
                     <span>New Invoice Value:</span>
                     <span className="tabular-nums">Rs {finalTotal.toLocaleString(undefined, {minimumFractionDigits:2})}</span>
                  </div>
                  <div className="flex justify-between items-center text-gray-500 border-b border-gray-200 pb-3 mt-3">
                     <span>Previous Balance:</span>
                     <span className={`tabular-nums font-mono ${previousBalance < 0 ? 'text-red-600' : ''}`}>Rs {previousBalance.toLocaleString(undefined, {minimumFractionDigits:2})}</span>
                  </div>
                  <div className="flex justify-between items-center bg-gray-900 text-white p-3 rounded-lg font-bold text-xl mt-4 shadow-lg print:shadow-none print:border-2 print:border-gray-900 print:bg-white print:text-gray-900">
                     <span>Grand Total:</span>
                     <span className="tabular-nums tracking-tight">Rs {grandTotal.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                  </div>
               </div>
            </div>

            {/* Print Footer / Signatures */}
            <div className="mt-24 pt-4 text-xs text-gray-800 hidden print:block">
               <div className="flex justify-between px-8">
                  <div className="text-center w-48 border-t-2 border-gray-300 pt-2">
                     Authorized Signature
                  </div>
                  <div className="text-center w-48 border-t-2 border-gray-300 pt-2">
                     Receiving Signature & Checker
                  </div>
               </div>
               <div className="text-center text-gray-400 mt-12 pb-4">
                  <p>Thank you for your business!</p>
                  <p>Powered by System</p>
               </div>
            </div>
         </div>
      </div>
    </div>
  );
}

function ManageInvoicesTab() {
  const profile = useLiveQuery(() => db.profile.get(1));
  const invoices = useLiveQuery(() => db.salesInvoices.reverse().sortBy('date'));
  const customers = useLiveQuery(() => db.customers.toArray());
  const bookers = useLiveQuery(() => db.employees.where('role').equals('order_booker').toArray());
  const [selectedInvoice, setSelectedInvoice] = useState<any>(null);
  const [invoiceItems, setInvoiceItems] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');

  const filteredInvoices = invoices?.filter(inv => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return inv.id?.toString().includes(term) || inv.customerName.toLowerCase().includes(term);
  });

  const loadInvoicePreview = async (inv: any) => {
    setSelectedInvoice(inv);
    const items = await db.salesItems.where('invoiceId').equals(inv.id).toArray();
    setInvoiceItems(items);
  };

  const handleDelete = async (invoiceId: number) => {
    if(!confirm("Are you sure you want to delete this invoice? This will reverse stock and ledger entries.")) return;

    try {
      await db.transaction('rw', [db.salesInvoices, db.salesItems, db.products, db.customers, db.ledger], async () => {
        const inv = await db.salesInvoices.get(invoiceId);
        if(!inv) throw new Error("Invoice not found");

        // Reverse stock
        const items = await db.salesItems.where('invoiceId').equals(invoiceId).toArray();
        for (let item of items) {
           const prod = await db.products.get(item.productId);
           if(prod) {
              await db.products.update(prod.id!, { stock: prod.stock + item.qty });
           }
        }

        // Reverse ledger & customer balance
        const customer = await db.customers.get(inv.customerId);
        if(customer) {
           await db.customers.update(customer.id!, { balance: customer.balance - inv.total });
           await db.ledger.add({
             date: new Date().toISOString().split('T')[0],
             entityType: 'customer',
             entityId: customer.id!,
             type: 'credit',
             amount: inv.total,
             description: `Reversal for Deleted Invoice #${invoiceId}`,
             balanceAfter: customer.balance - inv.total
           });
        }

        await db.salesItems.where('invoiceId').equals(invoiceId).delete();
        await db.salesInvoices.delete(invoiceId);
      });
      toast.success("Invoice deleted successfully");
      setSelectedInvoice(null);
    } catch(e:any) {
      toast.error("Failed to delete invoice: " + e.message);
    }
  };

  return (
    <div className="flex flex-col lg:flex-row gap-6 print:block">
      {/* List */}
      <div className="w-full lg:w-1/3 space-y-4 print:hidden">
         <Card className="shadow-sm">
            <CardHeader className="pb-3 border-b border-gray-100">
               <CardTitle className="text-base font-semibold">Latest Invoices</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
               <div className="divide-y divide-gray-100 h-[600px] overflow-auto">
                  {invoices?.map(inv => (
                     <div key={inv.id} className={`p-4 cursor-pointer hover:bg-gray-50 transition ${selectedInvoice?.id === inv.id ? 'bg-blue-50' : ''}`} onClick={() => loadInvoicePreview(inv)}>
                        <div className="flex justify-between items-start">
                           <div>
                              <p className="font-semibold text-gray-900 text-sm">INV-{inv.id}</p>
                              <p className="text-xs text-gray-500 mt-0.5">{inv.customerName}</p>
                           </div>
                           <div className="text-right">
                              <p className="font-bold text-sm text-blue-600">Rs {inv.total.toLocaleString()}</p>
                              <p className="text-xs text-gray-400 mt-0.5">{inv.date}</p>
                           </div>
                        </div>
                     </div>
                  ))}
                  {invoices?.length === 0 && (
                     <div className="p-8 text-center text-gray-400 italic text-sm">No invoices found.</div>
                  )}
               </div>
            </CardContent>
         </Card>
      </div>

      {/* Preview container */}
      <div className="w-full lg:w-2/3 print:w-full">
         {selectedInvoice ? (
         <div className="bg-white border border-gray-200 rounded-sm shadow-sm print:border-none print:shadow-none relative">
            <div className="absolute top-4 right-4 flex gap-2 print:hidden">
               <Button variant="outline" size="sm" onClick={() => window.print()}><Printer className="w-4 h-4 mr-2" /> Print</Button>
               <Button variant="destructive" size="sm" onClick={() => handleDelete(selectedInvoice.id)}><Trash2 className="w-4 h-4 mr-2" /> Delete</Button>
            </div>
            
            <div className="p-8 print:p-0 mt-8 print:mt-0">
               {/* Header */}
               <div className="border-b-2 border-gray-800 pb-4 mb-6 flex justify-between items-end">
                  <div>
                    <h1 className="text-2xl font-bold tracking-tight text-gray-900 uppercase">{profile?.name || 'SOBAN AGENCIES'}</h1>
                    {profile?.tagline && <p className="text-sm tracking-widest text-gray-500 mt-1 uppercase">{profile.tagline}</p>}
                    <p className="text-xs text-gray-600 mt-2 whitespace-pre-line">
                      {profile?.address || 'Main Bazaar, City Center' }
                      {"\n"}Phone: {profile?.phone || '(+92) 300 1234567'}
                      {profile?.ownerContact && `\nOwner: ${profile.ownerContact}`}
                    </p>
                  </div>
                  <div className="text-right">
                    <h2 className="text-3xl font-light text-gray-400 tracking-wider">INVOICE</h2>
                    <p className="text-lg font-bold text-gray-900 mt-1"># INV-{selectedInvoice.id}</p>
                    <p className="text-sm font-medium mt-1">Date: {selectedInvoice.date}</p>
                  </div>
               </div>

               {/* Bill To */}
               <div className="mb-6 flex justify-between items-start gap-4">
                  <div>
                     <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Bill To</h3>
                     <div className="bg-gray-50/50 p-4 rounded-lg border border-gray-100 min-w-[250px]">
                        <p className="font-bold text-lg text-gray-900">{selectedInvoice.customerName}</p>
                        <p className="text-sm text-gray-600 mt-1">{customers?.find(c => c.id === selectedInvoice.customerId)?.address || 'No Address Provided'}</p>
                        <p className="text-sm text-gray-600">Ph: {customers?.find(c => c.id === selectedInvoice.customerId)?.phone || '-'}</p>
                        {selectedInvoice.orderBookerId && (
                           <div className="mt-3 pt-3 border-t border-gray-200">
                             <p className="text-xs text-gray-500 uppercase tracking-wider">Order Booker</p>
                             <p className="font-semibold text-sm text-gray-800">{bookers?.find(b => b.id === selectedInvoice.orderBookerId)?.name}</p>
                           </div>
                        )}
                     </div>
                  </div>
                  <div className="flex justify-end items-center mt-6">
                     <div className="w-56 text-right p-4 rounded-xl border border-blue-100 bg-blue-50/50 shadow-sm">
                        <p className="text-xs font-bold text-blue-600/70 uppercase tracking-widest mb-1">Final Total</p>
                        <p className="text-2xl font-bold text-blue-900 tracking-tight">Rs {selectedInvoice.total.toLocaleString(undefined, {minimumFractionDigits: 2})}</p>
                     </div>
                  </div>
               </div>

               {/* Items Table */}
               <div className="rounded-xl border border-gray-200 overflow-hidden mt-8">
                  <table className="w-full text-sm border-collapse bg-white">
                     <thead>
                        <tr className="bg-gray-50/80 border-b border-gray-200 text-gray-700">
                           <th className="py-3 px-4 text-left font-semibold">Item Description</th>
                           <th className="py-3 px-2 text-center font-semibold w-16">CTN</th>
                           <th className="py-3 px-2 text-center font-semibold w-16">PCS</th>
                           <th className="py-3 px-3 text-right font-semibold w-24">T.Rate</th>
                           <th className="py-3 px-3 text-right font-semibold w-20">Disc %</th>
                           <th className="py-3 px-4 text-right font-semibold w-32">Amount</th>
                        </tr>
                     </thead>
                     <tbody className="divide-y divide-gray-100">
                        {invoiceItems.map((item, idx) => (
                           <tr key={idx} className="group hover:bg-gray-50/50 transition-colors">
                              <td className="py-4 px-4">
                                 <p className="font-semibold text-gray-900">{item.productName}</p>
                              </td>
                              <td className="py-4 px-2 text-center font-medium bg-gray-50/30">{item.cartonQty || 0}</td>
                              <td className="py-4 px-2 text-center font-medium">{item.pieceQty || item.qty}</td>
                              <td className="py-4 px-3 text-right text-gray-600 tabular-nums font-mono">{item.tradeRate?.toFixed(2) || item.price?.toFixed(2)}</td>
                              <td className="py-4 px-3 text-right text-red-500 tabular-nums">{item.discountRate > 0 ? `${item.discountRate}%` : '-'}</td>
                              <td className="py-4 px-4 text-right tabular-nums font-bold text-gray-900">{item.total.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                           </tr>
                        ))}
                     </tbody>
                  </table>
               </div>

               <div className="mt-8 flex justify-end">
                  <div className="w-80 space-y-3 text-sm">
                     <div className="flex justify-between items-center text-gray-500">
                        <span>Subtotal:</span>
                        <span className="tabular-nums font-mono">Rs {selectedInvoice.subTotal.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                     </div>
                     {(selectedInvoice.discountValue > 0) && (
                        <div className="flex justify-between items-center text-red-500 bg-red-50/50 p-1.5 -mx-1.5 rounded">
                           <span>Invoice Disc:</span>
                           <span className="tabular-nums font-mono">- Rs {selectedInvoice.discountType === 'percentage' ? (selectedInvoice.subTotal * selectedInvoice.discountValue / 100).toLocaleString(undefined, {minimumFractionDigits: 2}) : selectedInvoice.discountValue.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                        </div>
                     )}
                     {(selectedInvoice.freight > 0) && (
                        <div className="flex justify-between items-center text-gray-500">
                           <span>Freight/Cargo:</span>
                           <span className="tabular-nums font-mono">+ Rs {selectedInvoice.freight.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                        </div>
                     )}
                     <div className="flex justify-between items-center font-bold text-gray-800 text-base mt-2 border-t border-gray-200 pt-3">
                        <span>New Invoice Value:</span>
                        <span className="tabular-nums">Rs {selectedInvoice.total.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                     </div>
                     <div className="flex justify-between items-center text-gray-500 border-b border-gray-200 pb-3 mt-3">
                        <span>Previous Balance:</span>
                        <span className={`tabular-nums font-mono ${(selectedInvoice.previousBalance || 0) < 0 ? 'text-red-600' : ''}`}>Rs {(selectedInvoice.previousBalance || 0).toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                     </div>
                     <div className="flex justify-between items-center bg-gray-900 text-white p-3 rounded-lg font-bold text-xl mt-4 shadow-lg print:shadow-none print:border-2 print:border-gray-900 print:bg-white print:text-gray-900">
                        <span>Grand Total:</span>
                        <span className="tabular-nums tracking-tight">Rs {(selectedInvoice.total + (selectedInvoice.previousBalance || 0)).toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                     </div>
                  </div>
               </div>

               {/* Print Footer / Signatures */}
               <div className="mt-24 pt-4 text-xs text-gray-800 hidden print:block">
                  <div className="flex justify-between px-8">
                     <div className="text-center w-48 border-t-2 border-gray-300 pt-2">
                        Authorized Signature
                     </div>
                     <div className="text-center w-48 border-t-2 border-gray-300 pt-2">
                        Receiving Signature & Checker
                     </div>
                  </div>
                  <div className="text-center text-gray-400 mt-12 pb-4">
                     <p>Thank you for your business!</p>
                     <p>Powered by System</p>
                  </div>
               </div>

            </div>
         </div>
         ) : (
            <div className="h-full flex items-center justify-center p-12 text-gray-400 print:hidden text-sm">
               Select an invoice from the list to view its details.
            </div>
         )}
      </div>
    </div>
  );
}
