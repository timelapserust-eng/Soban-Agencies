import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import SalesInvoice from './pages/SalesInvoice';
import MasterData from './pages/MasterData';
import Ledger from './pages/Ledger';
import Inventory from './pages/Inventory';

import Returns from './pages/Returns';
import Reports from './pages/Reports';
import Settings from './pages/Settings';
import Login from './pages/Login';

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    const authStatus = sessionStorage.getItem('isAuthenticated');
    if (authStatus === 'true') {
      setIsAuthenticated(true);
    }
  }, []);

  const handleLogin = () => {
    setIsAuthenticated(true);
    sessionStorage.setItem('isAuthenticated', 'true');
  };

  if (!isAuthenticated) {
    return <Login onLogin={handleLogin} />;
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Dashboard />} />
          <Route path="sales" element={<SalesInvoice />} />
          <Route path="master" element={<MasterData />} />
          <Route path="ledger" element={<Ledger />} />
          <Route path="inventory" element={<Inventory />} />
          <Route path="returns" element={<Returns />} />
          <Route path="reports" element={<Reports />} />
          <Route path="settings" element={<Settings />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
