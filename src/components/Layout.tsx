import { Link, Outlet, useLocation } from 'react-router-dom';
import { LayoutDashboard, ShoppingCart, Users, BookOpen, Package, RotateCcw, BarChart3, Settings as SettingsIcon } from 'lucide-react';
import { Toaster } from '@/components/ui/sonner';
import { motion, AnimatePresence } from 'motion/react';

export default function Layout() {
  const location = useLocation();

  const navItems = [
    { name: 'Dashboard', path: '/', icon: LayoutDashboard },
    { name: 'Sales Invoice', path: '/sales', icon: ShoppingCart },
    { name: 'Inventory/Purchase', path: '/inventory', icon: Package },
    { name: 'Returns', path: '/returns', icon: RotateCcw },
    { name: 'Ledger', path: '/ledger', icon: BookOpen },
    { name: 'Reports', path: '/reports', icon: BarChart3 },
    { name: 'Master Data', path: '/master', icon: Users },
    { name: 'Settings', path: '/settings', icon: SettingsIcon },
  ];

  return (
    <div className="flex h-screen bg-gray-50 text-gray-900 font-sans">
      {/* Sidebar */}
      <div className="w-64 bg-black text-white flex flex-col h-full border-r border-gray-200">
        <div className="p-6">
          <h1 className="text-xl font-bold tracking-tight">Soban Agencies</h1>
          <p className="text-[10px] text-gray-400 mt-1 uppercase tracking-widest font-mono">Distributor System</p>
        </div>
        <nav className="flex-1 px-4 space-y-1 mt-4">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path || (item.path !== '/' && location.pathname.startsWith(item.path));
            const Icon = item.icon;
            
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center px-4 py-3 text-sm font-medium rounded-md transition-colors ${
                  isActive
                    ? 'bg-white text-black'
                    : 'text-gray-400 hover:bg-gray-900 hover:text-white'
                }`}
              >
                <Icon className="mr-3 h-4 w-4" />
                {item.name}
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        <header className="bg-white border-b border-gray-200 h-16 flex items-center px-8 shrink-0 justify-between">
          <h2 className="text-lg font-semibold text-gray-900 tracking-tight">
            {navItems.find(i => location.pathname === i.path || (i.path !== '/' && location.pathname.startsWith(i.path)))?.name || 'Dashboard'}
          </h2>
          <div className="flex items-center gap-4">
             <div className="text-xs font-mono text-gray-500 uppercase tracking-wider">{new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric'})}</div>
          </div>
        </header>
        <main className="flex-1 overflow-auto bg-[#fafafa] relative">
          <AnimatePresence mode="wait">
            <motion.div
              key={location.pathname}
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -5 }}
              transition={{ duration: 0.15 }}
              className="p-8 h-full"
            >
              <Outlet />
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
      <Toaster />
    </div>
  );
}
