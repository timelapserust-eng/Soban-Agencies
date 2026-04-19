import { useState, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { db, Product } from '../db/db';
import { useLiveQuery } from 'dexie-react-hooks';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';

interface PurchaseItem {
  product: Product;
  qty: number;
  cost: number;
  total: number;
}

export default function Inventory() {
  const [activeTab, setActiveTab] = useState<'purchase' | 'stock'>('purchase');

  return (
    <div className="space-y-6">
      <div className="flex space-x-2 border-b border-gray-200">
        <button
           className={`pb-2 px-4 text-sm font-medium ${activeTab === 'purchase' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
           onClick={() => setActiveTab('purchase')}
        >
           Purchase Entry (Add Stock)
        </button>
        <button
           className={`pb-2 px-4 text-sm font-medium ${activeTab === 'stock' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
           onClick={() => setActiveTab('stock')}
        >
           Stock View
        </button>
      </div>

      {activeTab === 'purchase' && <PurchaseTab />}
      {activeTab === 'stock' && <StockTab />}
    </div>
  );
}

function PurchaseTab() {
  const products = useLiveQuery(() => db.products.toArray());
  const [supplierName, setSupplierName] = useState<string>('Cash Supplier');
  const [selectedProductId, setSelectedProductId] = useState<string>('');
  const [qty, setQty] = useState<number>(1);
  const [customCost, setCustomCost] = useState<number>(0);
  
  const [cart, setCart] = useState<PurchaseItem[]>([]);

  // auto fill custom cost when product selects
  const handleProductSelect = (val: string) => {
     setSelectedProductId(val);
     const p = products?.find(prod => prod.id?.toString() === val);
     if(p) setCustomCost(p.purchasePrice);
  };

  const handleAdd = () => {
     if (!selectedProductId) return;
     const product = products?.find(p => p.id?.toString() === selectedProductId);
     if (!product) return;
     
     const existingItemIndex = cart.findIndex(i => i.product.id === product.id);
     if (existingItemIndex >= 0) {
        const newCart = [...cart];
        newCart[existingItemIndex].qty += qty;
        newCart[existingItemIndex].cost = customCost; // use latest cost
        newCart[existingItemIndex].total = newCart[existingItemIndex].qty * customCost;
        setCart(newCart);
     } else {
        setCart([...cart, {
          product,
          qty,
          cost: customCost,
          total: qty * customCost
        }]);
     }
     
     setSelectedProductId('');
     setQty(1);
     setCustomCost(0);
   };

   const handleSavePurchase = async () => {
      if(cart.length === 0) {
         toast.error("Cart is empty");
         return;
      }
      try {
         await db.transaction('rw', db.products, async () => {
            for (const item of cart) {
               const p = await db.products.get(item.product.id!);
               if (p) {
                  await db.products.update(p.id!, { 
                     stock: p.stock + item.qty,
                     purchasePrice: item.cost // update to latest purchase cost
                  });
               }
            }
         });
         toast.success("Purchase saved and stock updated!");
         setCart([]);
         setSupplierName('Cash Supplier');
      } catch (e) {
         console.error(e);
         toast.error("Failed to save purchase");
      }
   };

   const removeFromCart = (index: number) => {
      setCart(cart.filter((_, i) => i !== index));
   };

   const totalAmount = cart.reduce((acc, item) => acc + item.total, 0);

  return (
      <div className="flex flex-col lg:flex-row gap-6">
         <Card className="w-full lg:w-1/3 shadow-sm border-none bg-white">
            <CardHeader className="pb-3 border-b border-gray-100">
               <CardTitle className="text-base">New Purchase / Add Stock</CardTitle>
            </CardHeader>
            <CardContent className="pt-4 space-y-4">
               <div className="space-y-1.5">
                  <Label className="text-xs">Supplier / Remarks</Label>
                  <Input value={supplierName} onChange={e=>setSupplierName(e.target.value)} className="h-9"/>
               </div>
               
               <div className="space-y-1.5">
                  <Label className="text-xs">Product</Label>
                  <Select value={selectedProductId} onValueChange={handleProductSelect}>
                     <SelectTrigger className="h-9">
                        <SelectValue placeholder="Select Product" />
                     </SelectTrigger>
                     <SelectContent>
                        {products?.map(p => (
                           <SelectItem key={p.id} value={p.id!.toString()}>{p.name} ({p.code})</SelectItem>
                        ))}
                     </SelectContent>
                  </Select>
               </div>

               <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                     <Label className="text-xs">Quantity</Label>
                     <Input type="number" min="1" value={qty} onChange={e=>setQty(parseInt(e.target.value)||1)} className="h-9" />
                  </div>
                  <div className="space-y-1.5">
                     <Label className="text-xs">Unit Cost</Label>
                     <Input type="number" value={customCost} onChange={e=>setCustomCost(parseFloat(e.target.value)||0)} className="h-9" />
                  </div>
               </div>

               <Button onClick={handleAdd} className="w-full mt-2" variant="outline">Add to List</Button>
            </CardContent>
         </Card>

         <Card className="w-full lg:w-2/3 shadow-sm border-none bg-white">
            <CardHeader className="pb-3 flex flex-row items-center justify-between border-b border-gray-100">
               <CardTitle className="text-base">Purchase Cart</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
               <table className="w-full text-sm text-left">
                  <thead className="bg-gray-50/50 text-gray-500">
                     <tr>
                        <th className="px-4 py-2 font-medium">Product</th>
                        <th className="px-4 py-2 font-medium text-center">Qty</th>
                        <th className="px-4 py-2 font-medium text-right">Cost (Rs)</th>
                        <th className="px-4 py-2 font-medium text-right">Total</th>
                        <th className="px-4 py-2 w-10"></th>
                     </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                     {cart.map((item, idx) => (
                        <tr key={idx}>
                           <td className="px-4 py-3">{item.product.name}</td>
                           <td className="px-4 py-3 text-center">{item.qty}</td>
                           <td className="px-4 py-3 text-right">{item.cost.toFixed(2)}</td>
                           <td className="px-4 py-3 text-right font-medium">{item.total.toFixed(2)}</td>
                           <td className="px-4 py-3 text-right">
                              <button onClick={()=>removeFromCart(idx)} className="text-red-500 hover:text-red-700 font-bold">x</button>
                           </td>
                        </tr>
                     ))}
                     {cart.length === 0 && (
                        <tr><td colSpan={5} className="p-6 text-center text-gray-400 italic">No products added.</td></tr>
                     )}
                  </tbody>
               </table>
               {cart.length > 0 && (
                  <div className="p-4 bg-gray-50 flex items-center justify-between border-t border-gray-100">
                     <span className="font-medium text-gray-600">Total Purchase Value:</span>
                     <span className="text-xl font-bold">Rs {totalAmount.toFixed(2)}</span>
                     <Button onClick={handleSavePurchase} className="bg-green-600 hover:bg-green-700 text-white shadow-none">Commit Stock</Button>
                  </div>
               )}
            </CardContent>
         </Card>
      </div>
  );
}

function StockTab() {
  const products = useLiveQuery(() => db.products.toArray());
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<Partial<Product>>({});

  const totalStockValue = products?.reduce((acc, p) => acc + (p.stock * p.purchasePrice), 0) || 0;
  const totalSaleValue = products?.reduce((acc, p) => acc + (p.stock * p.salePrice), 0) || 0;

  const handleEdit = (p: Product) => {
     setEditingId(p.id!);
     setEditForm({ ...p });
  };

  const handleSave = async (id: number) => {
     try {
        await db.products.update(id, editForm);
        toast.success("Product updated successfully");
        setEditingId(null);
     } catch (e) {
        toast.error("Failed to update product");
     }
  };

  return (
     <div className="space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
           <Card className="shadow-none border border-gray-200">
              <CardContent className="p-4 pb-2">
                 <p className="text-xs text-gray-500 uppercase tracking-widest font-medium">Total Items</p>
                 <p className="text-xl font-semibold mt-1">{products?.length || 0}</p>
              </CardContent>
           </Card>
           <Card className="shadow-none border border-gray-200">
              <CardContent className="p-4 pb-2">
                 <p className="text-xs text-gray-500 uppercase tracking-widest font-medium">Est. Cost Value</p>
                 <p className="text-xl font-semibold mt-1 text-gray-700">Rs {totalStockValue.toLocaleString()}</p>
              </CardContent>
           </Card>
           <Card className="shadow-none border border-gray-200">
              <CardContent className="p-4 pb-2">
                 <p className="text-xs text-gray-500 uppercase tracking-widest font-medium">Est. Sale Value</p>
                 <p className="text-xl font-semibold mt-1 text-green-700">Rs {totalSaleValue.toLocaleString()}</p>
              </CardContent>
           </Card>
        </div>

        <Card className="shadow-sm border-none bg-white">
           <CardHeader className="pb-3 border-b border-gray-100">
              <CardTitle className="text-base font-semibold text-gray-800">Current Inventory</CardTitle>
           </CardHeader>
           <CardContent className="p-0">
             <div className="overflow-x-auto">
               <table className="w-full text-sm text-left">
                  <thead className="bg-slate-50 text-slate-500">
                     <tr>
                        <th className="px-4 py-3 font-medium">Code</th>
                        <th className="px-4 py-3 font-medium">Product Name</th>
                        <th className="px-4 py-3 font-medium">Category</th>
                        <th className="px-4 py-3 font-medium text-right">In Stock</th>
                        <th className="px-4 py-3 font-medium text-right">Cost Price</th>
                        <th className="px-4 py-3 font-medium text-right">Sale Price</th>
                        <th className="px-4 py-3 font-medium text-right">Actions</th>
                     </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                     {products?.map(p => (
                        <tr key={p.id} className="hover:bg-slate-50/50">
                           {editingId === p.id ? (
                              <>
                                 <td className="px-2 py-2"><Input value={editForm.code} onChange={e=>setEditForm({...editForm, code: e.target.value})} className="h-8 text-xs font-mono" /></td>
                                 <td className="px-2 py-2"><Input value={editForm.name} onChange={e=>setEditForm({...editForm, name: e.target.value})} className="h-8 text-xs" /></td>
                                 <td className="px-2 py-2"><Input value={editForm.category} onChange={e=>setEditForm({...editForm, category: e.target.value})} className="h-8 text-xs" /></td>
                                 <td className="px-2 py-2"><Input type="number" value={editForm.stock} onChange={e=>setEditForm({...editForm, stock: parseInt(e.target.value)||0})} className="h-8 text-xs text-right" /></td>
                                 <td className="px-2 py-2"><Input type="number" value={editForm.purchasePrice} onChange={e=>setEditForm({...editForm, purchasePrice: parseFloat(e.target.value)||0})} className="h-8 text-xs text-right" /></td>
                                 <td className="px-2 py-2"><Input type="number" value={editForm.salePrice} onChange={e=>setEditForm({...editForm, salePrice: parseFloat(e.target.value)||0})} className="h-8 text-xs text-right" /></td>
                                 <td className="px-2 py-2 text-right">
                                    <Button size="sm" onClick={() => handleSave(p.id!)} className="h-8 px-2 bg-green-600 hover:bg-green-700">Save</Button>
                                    <Button size="sm" variant="ghost" onClick={() => setEditingId(null)} className="h-8 px-2 ml-1">Cancel</Button>
                                 </td>
                              </>
                           ) : (
                              <>
                                 <td className="px-4 py-3 font-mono text-xs text-slate-500">{p.code}</td>
                                 <td className="px-4 py-3 text-slate-900 font-medium">{p.name}</td>
                                 <td className="px-4 py-3 text-slate-500">{p.category || '-'}</td>
                                 <td className="px-4 py-3 text-right">
                                    <span className={`px-2 py-0.5 rounded-full font-medium text-xs ${p.stock < 10 ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                                       {p.stock}
                                    </span>
                                 </td>
                                 <td className="px-4 py-3 text-right text-slate-500">Rs {p.purchasePrice}</td>
                                 <td className="px-4 py-3 text-right tabular-nums text-slate-900">Rs {p.salePrice}</td>
                                 <td className="px-4 py-3 text-right">
                                    <Button size="sm" variant="ghost" onClick={() => handleEdit(p)} className="h-8 px-2 text-blue-600 hover:text-blue-700 hover:bg-blue-50">Edit</Button>
                                 </td>
                              </>
                           )}
                        </tr>
                     ))}
                     {!products?.length && (
                        <tr><td colSpan={7} className="p-8 text-center text-slate-400 italic">No inventory available</td></tr>
                     )}
                  </tbody>
               </table>
             </div>
           </CardContent>
        </Card>
     </div>
  );
}
