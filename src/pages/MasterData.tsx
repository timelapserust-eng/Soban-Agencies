import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { db, Customer } from '../db/db';
import { useLiveQuery } from 'dexie-react-hooks';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';

export default function MasterData() {
  const [activeTab, setActiveTab] = useState<'products' | 'customers' | 'employees'>('products');

  return (
    <div className="space-y-6">
      <div className="flex space-x-2 border-b border-gray-200 overflow-x-auto">
        <button
          className={`pb-2 px-4 text-sm font-medium whitespace-nowrap ${activeTab === 'products' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
          onClick={() => setActiveTab('products')}
        >
          Products
        </button>
        <button
          className={`pb-2 px-4 text-sm font-medium whitespace-nowrap ${activeTab === 'customers' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
          onClick={() => setActiveTab('customers')}
        >
          Customers
        </button>
        <button
          className={`pb-2 px-4 text-sm font-medium whitespace-nowrap ${activeTab === 'employees' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
          onClick={() => setActiveTab('employees')}
        >
          Order Bookers & Staff
        </button>
      </div>

      {activeTab === 'products' && <ProductsTab />}
      {activeTab === 'customers' && <CustomersTab />}
      {activeTab === 'employees' && <EmployeesTab />}
    </div>
  );
}

function ProductsTab() {
  const products = useLiveQuery(() => db.products.toArray());
  const [form, setForm] = useState({ code: '', name: '', category: '', purchasePrice: 0, salePrice: 0, piecesPerCarton: 1, itemsPerPiece: 1 });
  const [stockCartons, setStockCartons] = useState<number>(0);
  const [stockPieces, setStockPieces] = useState<number>(0);
  const [stockLoose, setStockLoose] = useState<number>(0);
  
  const [searchTerm, setSearchTerm] = useState('');

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.code || !form.name) return;
    
    // Calculate total actual pieces
    const totalStock = (stockCartons * form.piecesPerCarton) + stockPieces + (stockLoose / (form.itemsPerPiece || 1));
    
    await db.products.add({ ...form, stock: totalStock });
    
    setForm({ code: '', name: '', category: '', purchasePrice: 0, salePrice: 0, piecesPerCarton: 1, itemsPerPiece: 1 });
    setStockCartons(0);
    setStockPieces(0);
    setStockLoose(0);
    toast.success("Product added");
  };

  const filteredProducts = products?.filter(p => 
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    p.code.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 print:block">
      <Card className="xl:col-span-1 shadow-sm print:hidden">
        <CardHeader>
          <CardTitle className="text-lg">Add Product</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleAdd} className="space-y-4">
            <div className="space-y-2">
              <Label>Product Code</Label>
              <Input value={form.code} onChange={e => setForm({ ...form, code: e.target.value })} required />
            </div>
            <div className="space-y-2">
              <Label>Product Name</Label>
              <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required />
            </div>
            <div className="space-y-2">
              <Label>Category</Label>
              <Input value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Pur. Price</Label>
                <Input type="number" step="0.01" value={form.purchasePrice} onChange={e => setForm({ ...form, purchasePrice: parseFloat(e.target.value) || 0 })} />
              </div>
              <div className="space-y-2">
                <Label>Sale Price</Label>
                <Input type="number" step="0.01" value={form.salePrice} onChange={e => setForm({ ...form, salePrice: parseFloat(e.target.value) || 0 })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Pieces / Carton</Label>
                <Input type="number" min="1" value={form.piecesPerCarton} onChange={e => setForm({ ...form, piecesPerCarton: parseInt(e.target.value) || 1 })} />
              </div>
              <div className="space-y-2">
                <Label>Loose Items / Piece</Label>
                <Input type="number" min="1" value={form.itemsPerPiece} onChange={e => setForm({ ...form, itemsPerPiece: parseInt(e.target.value) || 1 })} />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2 border-t border-gray-100 pt-3">
              <div className="col-span-3"><Label className="text-blue-600 font-semibold">Opening Stock</Label></div>
              <div className="space-y-2">
                <Label className="text-xs">Cartons</Label>
                <Input type="number" value={stockCartons} onChange={e => setStockCartons(parseInt(e.target.value) || 0)} min={0}/>
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Pieces</Label>
                <Input type="number" value={stockPieces} onChange={e => setStockPieces(parseInt(e.target.value) || 0)} min={0}/>
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Loose</Label>
                <Input type="number" value={stockLoose} onChange={e => setStockLoose(parseInt(e.target.value) || 0)} min={0}/>
              </div>
            </div>
            <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700">Save Product</Button>
          </form>
        </CardContent>
      </Card>
      
      <Card className="xl:col-span-2 shadow-sm border-gray-200 print:shadow-none print:border-none print:w-full">
        <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between space-y-2 sm:space-y-0 print:border-b-2 print:border-gray-800 print:pb-4">
          <div>
             <CardTitle className="text-lg">Product List & Value</CardTitle>
             <p className="text-xs text-gray-500 uppercase tracking-widest mt-1">Total System Items: {products?.length || 0}</p>
          </div>
          <div className="flex gap-2 w-full sm:w-auto print:hidden">
             <Button variant="outline" size="sm" onClick={() => window.print()}>Print Inventory</Button>
             <Input 
               placeholder="Search code or name..." 
               value={searchTerm}
               onChange={(e) => setSearchTerm(e.target.value)}
               className="max-w-[200px]"
             />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left border-collapse">
              <thead className="bg-gray-50 text-gray-600 print:bg-transparent border-b-2 border-gray-800">
                <tr>
                  <th className="px-4 py-3 font-semibold">Code/Name</th>
                  <th className="px-4 py-3 font-semibold text-center">Pack</th>
                  <th className="px-4 py-3 font-semibold text-right">P.Price</th>
                  <th className="px-4 py-3 font-semibold text-right">S.Price</th>
                  <th className="px-4 py-3 font-semibold text-center">Stock</th>
                  <th className="px-4 py-3 font-semibold text-right">Stock Value</th>
                  <th className="px-4 py-3 font-semibold text-right print:hidden"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 table-row-group text-sm">
                {filteredProducts?.map(p => {
                  const ppc = p.piecesPerCarton || 1;
                  const ctn = Math.floor(p.stock / ppc);
                  const pcs = p.stock % ppc;
                  const stockValue = p.stock * p.purchasePrice;
                  
                  return (
                    <tr key={p.id} className="hover:bg-gray-50/50 transition-colors group">
                      <td className="px-4 py-3">
                         <p className="font-semibold text-gray-900">{p.name}</p>
                         <p className="text-xs text-gray-500 font-mono">{p.code}</p>
                      </td>
                      <td className="px-4 py-3 text-center text-xs text-gray-500">1x{ppc}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{p.purchasePrice.toFixed(2)}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{p.salePrice.toFixed(2)}</td>
                      <td className="px-4 py-3 text-center">
                         <span className="font-medium bg-blue-50 text-blue-800 px-2 py-0.5 rounded text-xs">{ctn} CTN</span>
                         {pcs > 0 && <span className="font-medium text-gray-600 ml-1 text-xs"> {pcs} PCS</span>}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums font-semibold text-gray-800">Rs {stockValue.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                      <td className="px-4 py-3 text-right print:hidden opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-red-500 hover:text-red-700 hover:bg-red-50 rounded" onClick={() => db.products.delete(p.id!)}>X</Button>
                      </td>
                    </tr>
                  );
                })}
                {!filteredProducts?.length && (
                  <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-500">No products found in system.</td></tr>
                )}
                {filteredProducts && filteredProducts.length > 0 && (
                   <tr className="bg-gray-50 border-t-2 border-gray-800 font-bold">
                     <td colSpan={5} className="px-4 py-3 text-right uppercase tracking-wider text-xs">Total Inventory Value:</td>
                     <td className="px-4 py-3 text-right text-lg text-blue-900">Rs {filteredProducts.reduce((sum, p) => sum + (p.stock * p.purchasePrice), 0).toLocaleString(undefined, {minimumFractionDigits:2})}</td>
                     <td className="print:hidden"></td>
                   </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function CustomersTab() {
  const customers = useLiveQuery(() => db.customers.toArray());
  const employees = useLiveQuery(() => db.employees.where('role').equals('order_booker').toArray());
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<Partial<Customer>>({});
  const [form, setForm] = useState<Partial<Customer>>({ name: '', phone: '', address: '', type: 'Retailer', balance: 0 });

  const handleEdit = (c: Customer) => {
    setEditingId(c.id!);
    setEditForm({ ...c });
  };

  const handleSaveEdit = async (id: number) => {
    try {
      await db.customers.update(id, editForm);
      toast.success("Customer metadata updated successfully");
      setEditingId(null);
    } catch (e) {
      toast.error("Failed to update customer");
    }
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name) return;
    await db.customers.add({ ...form });
    if(form.balance !== 0) {
      // Add opening balance ledger entry
      const addedCustomer = await db.customers.where('name').equals(form.name).first();
      if(addedCustomer && addedCustomer.id) {
         await db.ledger.add({
           date: new Date().toISOString().split('T')[0],
           entityType: 'customer',
           entityId: addedCustomer.id,
           type: form.balance > 0 ? 'debit' : 'credit',
           amount: Math.abs(form.balance),
           description: 'Opening Balance',
           balanceAfter: form.balance
         });
      }
    }
    setForm({ name: '', phone: '', address: '', type: 'Retailer', balance: 0 });
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      <Card className="md:col-span-1 shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg">Add Customer</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleAdd} className="space-y-4">
            <div className="space-y-2">
              <Label>Customer Name</Label>
              <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required />
            </div>
            <div className="space-y-2">
              <Label>Phone</Label>
              <Input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Address/Area</Label>
              <Input value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Type</Label>
              <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Retailer">Retailer</SelectItem>
                  <SelectItem value="Distributor">Distributor</SelectItem>
                  <SelectItem value="Sub-distributor">Sub-distributor</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label>Default Order Booker (Optional)</Label>
              <Select value={form.linkedBookerId?.toString() || "none"} onValueChange={(v) => setForm({ ...form, linkedBookerId: v === 'none' ? undefined : parseInt(v) })}>
                <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {employees?.map(e => (
                     <SelectItem key={e.id} value={e.id!.toString()}>{e.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Opening Balance</Label>
              <Input type="number" value={form.balance} onChange={e => setForm({ ...form, balance: parseFloat(e.target.value) || 0 })} />
              <p className="text-xs text-slate-500">Positive for Receivable, Negative for Payable</p>
            </div>
            <Button type="submit" className="w-full">Save Customer</Button>
          </form>
        </CardContent>
      </Card>
      
      <Card className="md:col-span-2 shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg">Customer List</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-gray-100/50 text-gray-500">
                <tr>
                  <th className="px-4 py-3 font-medium">Name</th>
                  <th className="px-4 py-3 font-medium">Area</th>
                  <th className="px-4 py-3 font-medium">Type & Booker</th>
                  <th className="px-4 py-3 font-medium text-right">Balance</th>
                  <th className="px-4 py-3 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {customers?.map(c => (
                  <tr key={c.id} className="hover:bg-gray-50/50 transition-colors">
                    {editingId === c.id ? (
                      <>
                        <td className="px-2 py-2"><Input value={editForm.name} onChange={e=>setEditForm({...editForm, name: e.target.value})} className="h-8 text-xs font-medium" /></td>
                        <td className="px-2 py-2">
                           <Input value={editForm.address} onChange={e=>setEditForm({...editForm, address: e.target.value})} placeholder="Address" className="h-8 text-xs mb-1" />
                           <Input value={editForm.phone} onChange={e=>setEditForm({...editForm, phone: e.target.value})} placeholder="Phone" className="h-8 text-xs" />
                        </td>
                        <td className="px-2 py-2">
                           <Select value={editForm.type} onValueChange={(v) => setEditForm({...editForm, type: v})}>
                             <SelectTrigger className="h-8 text-xs mb-1"><SelectValue /></SelectTrigger>
                             <SelectContent>
                               <SelectItem value="Retailer">Retailer</SelectItem>
                               <SelectItem value="Distributor">Distributor</SelectItem>
                               <SelectItem value="Sub-distributor">Sub-distributor</SelectItem>
                             </SelectContent>
                           </Select>
                           <Select value={editForm.linkedBookerId?.toString() || "none"} onValueChange={(v) => setEditForm({...editForm, linkedBookerId: v === 'none' ? undefined : parseInt(v)})}>
                             <SelectTrigger className="h-8 text-xs bg-blue-50/50"><SelectValue placeholder="Booker" /></SelectTrigger>
                             <SelectContent>
                               <SelectItem value="none">No Booker</SelectItem>
                               {employees?.map(e => <SelectItem key={e.id} value={e.id!.toString()}>{e.name}</SelectItem>)}
                             </SelectContent>
                           </Select>
                        </td>
                        <td className="px-4 py-3 text-right font-medium text-gray-500">
                          {/* We don't edit balance directly here, it's done via Ledger */}
                          Rs {Math.abs(c.balance).toFixed(2)}
                        </td>
                        <td className="px-2 py-2 text-right">
                           <Button size="sm" onClick={() => handleSaveEdit(c.id!)} className="h-8 px-2 bg-green-600 hover:bg-green-700">Save</Button>
                           <Button size="sm" variant="ghost" onClick={() => setEditingId(null)} className="h-8 px-2 ml-1">Cancel</Button>
                        </td>
                      </>
                    ) : (
                      <>
                        <td className="px-4 py-3 font-medium text-gray-900">{c.name}</td>
                        <td className="px-4 py-3 text-gray-600">
                           <p>{c.address || '-'}</p>
                           <p className="text-xs text-gray-400 font-mono mt-0.5">{c.phone}</p>
                        </td>
                        <td className="px-4 py-3 text-gray-600">
                           <p>{c.type}</p>
                           {c.linkedBookerId && (
                               <p className="text-xs text-blue-600 mt-0.5 bg-blue-50 inline-block px-1 rounded">
                                  {employees?.find(e => e.id === c.linkedBookerId)?.name || 'Unknown'}
                               </p>
                           )}
                        </td>
                        <td className={`px-4 py-3 text-right font-medium ${c.balance > 0 ? 'text-green-600' : c.balance < 0 ? 'text-red-600' : 'text-gray-500'}`}>
                          Rs {Math.abs(c.balance).toFixed(2)} {c.balance > 0 ? 'Dr' : c.balance < 0 ? 'Cr' : ''}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <Button variant="ghost" size="sm" className="h-8 px-2 text-blue-600 hover:text-blue-700 hover:bg-blue-50" onClick={() => handleEdit(c)}>Edit</Button>
                          <Button variant="ghost" size="sm" className="h-8 px-2 text-red-600 hover:text-red-700 hover:bg-red-50" onClick={() => db.customers.delete(c.id!)}>Delete</Button>
                        </td>
                      </>
                    )}
                  </tr>
                ))}
                {!customers?.length && (
                  <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-500">No customers found.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function EmployeesTab() {
  const employees = useLiveQuery(() => db.employees.toArray());
  const [searchTerm, setSearchTerm] = useState('');
  const [form, setForm] = useState<{name: string, role: string, pin: string}>({ name: '', role: 'order_booker', pin: '' });

  const filteredEmployees = employees?.filter(e => {
     if(!searchTerm) return true;
     return e.name.toLowerCase().includes(searchTerm.toLowerCase()) || e.role.toLowerCase().includes(searchTerm.toLowerCase());
  });

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.role) return;
    await db.employees.add({ ...form } as any);
    setForm({ name: '', role: 'order_booker', pin: '' });
    toast.success("Employee added/updated");
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      <Card className="md:col-span-1 shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg">Add Staff</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleAdd} className="space-y-4">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required />
            </div>
            <div className="space-y-2">
              <Label>Role</Label>
              <Select value={form.role} onValueChange={v => setForm({ ...form, role: v })}>
                 <SelectTrigger className="bg-white"><SelectValue/></SelectTrigger>
                 <SelectContent>
                    <SelectItem value="admin">Admin</SelectItem>
                    <SelectItem value="manager">Manager</SelectItem>
                    <SelectItem value="order_booker">Order Booker</SelectItem>
                    <SelectItem value="delivery_man">Delivery Man</SelectItem>
                 </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>PIN (Auth)</Label>
              <Input value={form.pin} onChange={e => setForm({ ...form, pin: e.target.value })} placeholder="xxxx" />
            </div>
            <Button type="submit" className="w-full">Save Staff Member</Button>
          </form>
        </CardContent>
      </Card>
      
      <Card className="md:col-span-2 shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg">Staff List (Total: {filteredEmployees?.length || 0})</CardTitle>
          <Input 
             placeholder="Search name or role..." 
             value={searchTerm}
             onChange={e => setSearchTerm(e.target.value)}
             className="w-48 h-9"
          />
        </CardHeader>
        <CardContent className="p-0">
          <table className="w-full text-sm text-left">
            <thead className="bg-gray-100/50 text-gray-500">
              <tr>
                <th className="px-4 py-3 font-medium">ID</th>
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Role</th>
                <th className="px-4 py-3 font-medium">PIN</th>
                <th className="px-4 py-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredEmployees?.map(e => (
                <tr key={e.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-gray-500">#{e.id}</td>
                  <td className="px-4 py-3 font-medium text-gray-900">{e.name}</td>
                  <td className="px-4 py-3 text-gray-600 capitalize">{e.role.replace('_', ' ')}</td>
                  <td className="px-4 py-3 text-gray-400 font-mono">{e.pin || '-'}</td>
                  <td className="px-4 py-3 text-right">
                    <Button variant="ghost" size="sm" className="text-red-600 hover:text-red-700 hover:bg-red-50" onClick={() => db.employees.delete(e.id!)}>Delete</Button>
                  </td>
                </tr>
              ))}
              {!filteredEmployees?.length && (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-500">No staff found.</td></tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
