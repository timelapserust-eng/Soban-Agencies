import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { db, Product } from '../db/db';
import { useLiveQuery } from 'dexie-react-hooks';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Check, ChevronsUpDown, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

interface ReturnCartItem {
  product: Product;
  cartonQty: number;
  pieceQty: number;
  totalPieces: number;
  rate: number;
  total: number;
  reason: string;
}

export default function Returns() {
  const profile = useLiveQuery(() => db.profile.get(1));
  const products = useLiveQuery(() => db.products.toArray());
  const customers = useLiveQuery(() => db.customers.toArray());
  const suppliers = useLiveQuery(() => db.suppliers.toArray());

  const [returnType, setReturnType] = useState<'sale_return' | 'purchase_return'>('sale_return');
  
  const [selectedEntityId, setSelectedEntityId] = useState<string>('');
  const [entityOpen, setEntityOpen] = useState(false);

  const [selectedProductId, setSelectedProductId] = useState<string>('');
  const [productOpen, setProductOpen] = useState(false);
  
  const [cartonQty, setCartonQty] = useState<number>(0);
  const [pieceQty, setPieceQty] = useState<number>(0);
  const [looseQty, setLooseQty] = useState<number>(0);
  const [reason, setReason] = useState<string>('Damage');
  
  const [cart, setCart] = useState<ReturnCartItem[]>([]);

  const entities = returnType === 'sale_return' ? customers : suppliers;

  const handleAddToCart = () => {
    if (!selectedProductId) return;
    const product = products?.find(p => p.id?.toString() === selectedProductId);
    if (!product) return;
    
    const ppc = product.piecesPerCarton || 1;
    const loosePerTotal = product.itemsPerPiece || 1;
    
    // Calculates fractional pieces: e.g. 1 out of 40 loose items in a piece becomes 0.025
    let totalPieces = (cartonQty * ppc) + pieceQty + (looseQty / loosePerTotal);

    // Apply auto 2 pieces deduction logic for refunds if doing cotton returns (assumed when returning cartons specifically)
    if (cartonQty > 0) {
       totalPieces = Math.max(0, totalPieces - 2); 
    }

    if (totalPieces <= 0) {
      toast.error('Enter valid quantity');
      return;
    }

    if (returnType === 'purchase_return' && product.stock < totalPieces) {
      toast.error(`Insufficient stock to return! Only ${product.stock} pieces left.`);
      return;
    }

    const rate = returnType === 'sale_return' ? product.salePrice : product.purchasePrice;
    const grossTotal = totalPieces * rate;

    setCart([...cart, {
      product,
      cartonQty,
      pieceQty,
      looseQty,
      totalPieces,
      rate,
      total: grossTotal,
      reason
    }]);
    
    setSelectedProductId('');
    setCartonQty(0);
    setPieceQty(0);
    setLooseQty(0);
    toast.success('Added to return list');
  };

  const removeFromCart = (index: number) => {
    setCart(cart.filter((_, i) => i !== index));
  };

  const grandTotal = cart.reduce((acc, item) => acc + item.total, 0);

  const handleSaveReturn = async () => {
    if(!selectedEntityId) {
       toast.error(`Please select a ${returnType === 'sale_return' ? 'Customer' : 'Supplier'}`);
       return;
    }
    if(cart.length === 0) {
       toast.error('Return list is empty');
       return;
    }

    const entity = entities?.find(e => e.id?.toString() === selectedEntityId);
    if(!entity) return;

    try {
      await db.transaction('rw', [db.returns, db.returnItems, db.products, db.customers, db.suppliers, db.ledger], async () => {
        // 1. Save Return Head
        const returnId = await db.returns.add({
          date: new Date().toISOString().split('T')[0],
          type: returnType,
          entityId: entity.id!,
          entityName: entity.name,
          subTotal: grandTotal,
          discount: 0,
          total: grandTotal
        });

        // 2. Save Items & Adjust Stock
        for (const item of cart) {
          await db.returnItems.add({
            returnId,
            productId: item.product.id!,
            productName: item.product.name,
            cartonQty: item.cartonQty,
            pieceQty: item.pieceQty,
            looseQty: item.looseQty,
            qty: item.totalPieces,
            rate: item.rate,
            total: item.total
          });
          
          const p = await db.products.get(item.product.id!);
          if(p) {
             const stockDelta = returnType === 'sale_return' ? item.totalPieces : -item.totalPieces;
             await db.products.update(p.id!, { stock: p.stock + stockDelta });
          }
        }

        // 3. Ledger & Balance updates
        if (returnType === 'sale_return') {
           // Customer returned goods to us -> We credit their ledger (reduce their balance)
           const newBal = entity.balance - grandTotal;
           await db.customers.update(entity.id!, { balance: newBal });
           await db.ledger.add({
             date: new Date().toISOString().split('T')[0],
             entityType: 'customer',
             entityId: entity.id!,
             type: 'credit',
             amount: grandTotal,
             description: `Sales Return #${returnId}`,
             balanceAfter: newBal,
             orderBookerId: (entity as import('../db/db').Customer).linkedBookerId
           });
        } else {
           // We returned goods to supplier -> We debit their ledger (reduce our payable balance to them)
           const newBal = entity.balance - grandTotal;
           await db.suppliers.update(entity.id!, { balance: newBal });
           await db.ledger.add({
             date: new Date().toISOString().split('T')[0],
             entityType: 'supplier',
             entityId: entity.id!,
             type: 'debit',
             amount: grandTotal,
             description: `Purchase Return Outward #${returnId}`,
             balanceAfter: newBal
           });
        }
      });

      toast.success('Return Processed Successfully!');
      setCart([]);
      setSelectedEntityId('');
      
    } catch (e: any) {
      console.error(e);
      toast.error('Error saving return');
    }
  };

  return (
    <div className="flex flex-col lg:flex-row gap-6 print:block">
      <div className="w-full lg:w-1/3 space-y-4 print:hidden">
        <Card className="shadow-sm">
          <CardHeader className="pb-3">
             <CardTitle className="text-base font-semibold">Process Return</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
             <div className="flex space-x-2 bg-gray-100 p-1 rounded-md">
               <button
                 className={`flex-1 py-1.5 text-xs font-medium rounded ${returnType === 'sale_return' ? 'bg-white shadow relative' : 'text-gray-500'}`}
                 onClick={() => { setReturnType('sale_return'); setCart([]); setSelectedEntityId(''); }}
               >
                 Sales Return
               </button>
               <button
                 className={`flex-1 py-1.5 text-xs font-medium rounded ${returnType === 'purchase_return' ? 'bg-white shadow relative' : 'text-gray-500'}`}
                 onClick={() => { setReturnType('purchase_return'); setCart([]); setSelectedEntityId(''); }}
               >
                 Purchase Return
               </button>
             </div>

             <div className="space-y-1.5 flex flex-col pt-2 border-t border-gray-100">
               <Label className="text-xs">Search {returnType === 'sale_return' ? 'Customer' : 'Supplier'}</Label>
               <Popover open={entityOpen} onOpenChange={setEntityOpen}>
                 <PopoverTrigger asChild>
                   <Button variant="outline" role="combobox" aria-expanded={entityOpen} className="justify-between w-full h-9">
                     {selectedEntityId ? entities?.find((e) => e.id?.toString() === selectedEntityId)?.name : `Select...`}
                     <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                   </Button>
                 </PopoverTrigger>
                 <PopoverContent className="w-full p-0">
                   <Command>
                     <CommandInput placeholder="Search..." />
                     <CommandList>
                       <CommandEmpty>No results found.</CommandEmpty>
                       <CommandGroup>
                         {entities?.map((e) => (
                           <CommandItem
                             key={e.id}
                             value={e.name}
                             onSelect={(currentValue) => {
                               setSelectedEntityId(e.id!.toString());
                               setEntityOpen(false);
                             }}
                           >
                             <Check className={`mr-2 h-4 w-4 ${selectedEntityId === e.id?.toString() ? "opacity-100" : "opacity-0"}`} />
                             {e.name}
                           </CommandItem>
                         ))}
                       </CommandGroup>
                     </CommandList>
                   </Command>
                 </PopoverContent>
               </Popover>
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
                     <CommandInput placeholder="Search code or name..." />
                     <CommandList>
                       <CommandEmpty>No product found.</CommandEmpty>
                       <CommandGroup>
                         {products?.map((product) => (
                           <CommandItem
                             key={product.id}
                             value={`${product.code} ${product.name}`}
                             onSelect={() => {
                               setSelectedProductId(product.id!.toString());
                               setProductOpen(false);
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
                      <Input type="number" value={cartonQty} onChange={e => setCartonQty(parseInt(e.target.value) || 0)} min={0} className="h-9"/>
                   </div>
                   <div className="space-y-1">
                      <Label className="text-xs">Pieces</Label>
                      <Input type="number" value={pieceQty} onChange={e => setPieceQty(parseInt(e.target.value) || 0)} min={0} className="h-9"/>
                   </div>
                   <div className="space-y-1">
                      <Label className="text-xs">Loose</Label>
                      <Input type="number" value={looseQty} onChange={e => setLooseQty(parseInt(e.target.value) || 0)} min={0} className="h-9"/>
                   </div>
                </div>
                <div className="space-y-1 mt-2">
                   <Label className="text-xs">Reason</Label>
                   <Input value={reason} onChange={e => setReason(e.target.value)} className="h-9"/>
                </div>
                <Button onClick={handleAddToCart} variant="secondary" className="w-full h-9 mt-2">Add Entry</Button>
             </div>
          </CardContent>
        </Card>

        <div className="flex gap-3 pt-2">
           <Button className="flex-1 bg-red-600 hover:bg-red-700 text-white" onClick={handleSaveReturn}>Confirm Return</Button>
        </div>
      </div>

      {/* Return Document / Preview */}
      <div className="w-full lg:w-2/3 bg-white border border-gray-200 rounded-sm shadow-sm print:border-none print:shadow-none print:w-full">
         <div className="p-8 print:p-0">
            {/* Header */}
            <div className="border-b-2 border-gray-800 pb-4 mb-6 flex justify-between items-end">
               <div>
                 <h1 className="text-2xl font-bold tracking-tight text-gray-900 uppercase">{profile?.name || 'SOBAN AGENCIES'}</h1>
                 {profile?.tagline && <p className="text-sm tracking-widest text-gray-500 mt-1 uppercase">{profile.tagline}</p>}
               </div>
               <div className="text-right">
                 <h2 className="text-2xl font-light text-red-500 tracking-wider">
                    {returnType === 'sale_return' ? 'SALES RETURN' : 'PURCHASE RETURN'}
                 </h2>
                 <p className="text-sm font-medium mt-1">Date: {new Date().toLocaleDateString()}</p>
                 <p className="text-xs text-gray-500">Draft</p>
               </div>
            </div>

            {/* Entity Info */}
            <div className="mb-6 grid grid-cols-2 gap-4">
               <div>
                  <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">
                     {returnType === 'sale_return' ? 'Return From (Customer):' : 'Return To (Supplier):'}
                  </h3>
                  {selectedEntityId ? (
                     <div className="bg-gray-50 p-3 rounded-sm border border-gray-100">
                        <p className="font-semibold text-gray-900">{entities?.find(c => c.id?.toString() === selectedEntityId)?.name}</p>
                        <p className="text-sm text-gray-600">{entities?.find(c => c.id?.toString() === selectedEntityId)?.address || 'No Address Provided'}</p>
                     </div>
                  ) : (
                     <div className="text-sm text-gray-400 italic">Select entity...</div>
                  )}
               </div>
               <div className="flex justify-end items-center">
                  <div className="w-48 text-right p-3 border border-red-100 bg-red-50">
                     <p className="text-xs font-medium text-red-700 uppercase">Credit Note Value</p>
                     <p className="text-xl font-bold text-red-900">Rs {grandTotal.toLocaleString(undefined, {minimumFractionDigits: 2})}</p>
                  </div>
               </div>
            </div>

            {/* Items Table */}
            <table className="w-full text-sm mt-8 border-collapse">
               <thead>
                  <tr className="border-y-2 border-gray-800 text-gray-900">
                     <th className="py-2 px-1 text-left font-semibold">Item Description / Reason</th>
                     <th className="py-2 px-1 text-center font-semibold w-16">CTN</th>
                     <th className="py-2 px-1 text-center font-semibold w-16">PCS</th>
                     <th className="py-2 px-1 text-right font-semibold w-24">Rate (Rs)</th>
                     <th className="py-2 px-1 text-right font-semibold w-32">Amount</th>
                     <th className="py-2 px-1 text-center w-10 print:hidden"></th>
                  </tr>
               </thead>
               <tbody className="divide-y divide-gray-100">
                  {cart.map((item, idx) => (
                     <tr key={idx} className="group">
                        <td className="py-3 px-1">
                           <p className="font-medium text-gray-900">{item.product.name}</p>
                           <p className="text-xs text-gray-500">{item.reason}</p>
                        </td>
                        <td className="py-3 px-1 text-center font-medium">{item.cartonQty}</td>
                        <td className="py-3 px-1 text-center font-medium">{item.pieceQty}</td>
                        <td className="py-3 px-1 text-right tabular-nums">{item.rate.toFixed(2)}</td>
                        <td className="py-3 px-1 text-right tabular-nums font-medium text-gray-900">{item.total.toFixed(2)}</td>
                        <td className="py-3 px-1 text-right print:hidden opacity-0 group-hover:opacity-100 transition-opacity">
                           <button onClick={()=>removeFromCart(idx)} className="text-red-500 hover:bg-red-50 px-2 py-1 rounded text-xs">x</button>
                        </td>
                     </tr>
                  ))}
                  {cart.length === 0 && (
                     <tr>
                        <td colSpan={6} className="py-8 text-center text-gray-400 italic">No items added to return</td>
                     </tr>
                  )}
               </tbody>
            </table>

            {/* Totals Section */}
            <div className="mt-8 flex justify-end">
               <div className="w-64 space-y-2 text-sm">
                  <div className="flex justify-between items-center bg-gray-50 p-2 font-bold text-base mt-2 border-t-2 border-gray-800">
                     <span>Total Return Value:</span>
                     <span className="tabular-nums">Rs {grandTotal.toFixed(2)}</span>
                  </div>
               </div>
            </div>

         </div>
      </div>
    </div>
  );
}
