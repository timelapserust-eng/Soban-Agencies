import Dexie, { type EntityTable } from 'dexie';

export interface Customer {
  id?: number;
  name: string;
  phone: string;
  address: string;
  type: string; // Distributor, Sub-distributor, Retailer
  balance: number;
  linkedBookerId?: number; // Added to map customer to order booker directly
}

export interface Supplier {
  id?: number;
  name: string;
  phone: string;
  address: string;
  balance: number;
}

export interface Employee {
  id?: number;
  name: string;
  role: 'admin' | 'manager' | 'order_booker' | 'delivery_man';
  pin: string; // Simple local auth
}

export interface ReturnInvoice {
  id?: number;
  date: string;
  type: 'sale_return' | 'purchase_return';
  entityId: number; // customerId or supplierId
  entityName: string;
  subTotal: number;
  discount: number;
  total: number;
}

export interface ReturnItem {
  id?: number;
  returnId: number;
  productId: number;
  productName: string;
  cartonQty: number;
  pieceQty: number;
  looseQty?: number; // loose fractional amounts
  qty: number; // total pieces
  rate: number;
  total: number;
}

export interface Product {
  id?: number;
  code: string;
  name: string;
  category: string;
  purchasePrice: number;
  salePrice: number;
  piecesPerCarton: number;
  itemsPerPiece?: number; // Optional sub-pieces (like loose diapers inside a pack)
  stock: number;
}

export interface SalesInvoice {
  id?: number;
  firebaseId?: string; // If synced from mobile
  date: string;
  customerId: number;
  customerName: string;
  orderBookerId?: number; // New: which order booker took the order
  subTotal: number;
  freight: number;       // Freight explicitly top
  discountFixed: number; // Added specific type
  discountPercentage: number; // Added specific type
  discountValue: number; // Storing total derived fallback
  bilty: number;
  previousBalance: number; // Balance at time of invoice creation
  total: number;
  isSynced: boolean; // For mobile sync
}

export interface SalesItem {
  id?: number;
  invoiceId: number;
  productId: number;
  productName: string;
  cartonQty: number;   // New
  pieceQty: number;    // New
  looseQty?: number;   // New: loose fractional amounts
  qty: number;         // Total calculated pieces
  price: number;
  tradeRate: number;   // Cost per piece
  discountRate: number; // Item discount percentage
  total: number;
}

export interface LedgerEntry {
  id?: number;
  date: string;
  entityType: 'customer' | 'supplier' | 'employee';
  entityId: number;
  type: 'debit' | 'credit';
  amount: number;
  description: string;
  balanceAfter: number;
  orderBookerId?: number; // New for tracking booker specific collections/sales
}

export interface CompanyProfile {
  id?: number;
  name: string;
  tagline: string;
  address: string;
  phone: string;
  ownerContact: string;
  email: string;
}

class SystemDatabase extends Dexie {
  customers!: EntityTable<Customer, 'id'>;
  suppliers!: EntityTable<Supplier, 'id'>;
  employees!: EntityTable<Employee, 'id'>;
  products!: EntityTable<Product, 'id'>;
  salesInvoices!: EntityTable<SalesInvoice, 'id'>;
  salesItems!: EntityTable<SalesItem, 'id'>;
  ledger!: EntityTable<LedgerEntry, 'id'>;
  profile!: EntityTable<CompanyProfile, 'id'>;
  returns!: EntityTable<ReturnInvoice, 'id'>;
  returnItems!: EntityTable<ReturnItem, 'id'>;

  constructor() {
    super('SobanAgenciesDB');
    
    // Version 1
    this.version(1).stores({
      customers: '++id, name, phone, type',
      suppliers: '++id, name, phone',
      employees: '++id, name, role, pin',
      products: '++id, code, name, category',
      salesInvoices: '++id, date, customerId, isSynced, firebaseId',
      salesItems: '++id, invoiceId, productId',
      ledger: '++id, date, entityType, entityId, type'
    });

    // Version 2 - Added profile
    this.version(2).stores({
      customers: '++id, name, phone, type',
      suppliers: '++id, name, phone',
      employees: '++id, name, role, pin',
      products: '++id, code, name, category',
      salesInvoices: '++id, date, customerId, isSynced, firebaseId',
      salesItems: '++id, invoiceId, productId',
      ledger: '++id, date, entityType, entityId, type',
      profile: '++id'
    }).upgrade(trans => {
      trans.table('profile').add({
        name: 'SOBAN AGENCIES',
        tagline: 'Distributors & Wholesalers',
        address: 'Main Bazaar, City Center',
        phone: '(+92) 300 1234567',
        ownerContact: '',
        email: ''
      });
    });

    // Version 3 - Added Returns, Order Booker tracking
    this.version(3).stores({
      customers: '++id, name, phone, type',
      suppliers: '++id, name, phone',
      employees: '++id, name, role, pin',
      products: '++id, code, name, category',
      salesInvoices: '++id, date, customerId, orderBookerId, isSynced, firebaseId',
      salesItems: '++id, invoiceId, productId',
      ledger: '++id, date, entityType, entityId, type, orderBookerId',
      profile: '++id',
      returns: '++id, date, type, entityId',
      returnItems: '++id, returnId, productId'
    }).upgrade(trans => {
       // Insert default order booker for existing checks
       trans.table('employees').add({
          name: 'Booker 1',
          role: 'order_booker',
          pin: '1234'
       });
    });

    // Version 4 - Link bookers to customers
    this.version(4).stores({
      customers: '++id, name, phone, type, linkedBookerId',
      suppliers: '++id, name, phone',
      employees: '++id, name, role, pin',
      products: '++id, code, name, category',
      salesInvoices: '++id, date, customerId, orderBookerId, isSynced, firebaseId',
      salesItems: '++id, invoiceId, productId',
      ledger: '++id, date, entityType, entityId, type, orderBookerId',
      profile: '++id',
      returns: '++id, date, type, entityId',
      returnItems: '++id, returnId, productId'
    });
  }
}

export const db = new SystemDatabase();
