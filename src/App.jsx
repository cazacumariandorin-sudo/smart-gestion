import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { useEffect } from 'react';
import { I18nProvider } from './lib/i18n';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import AppLayout from './components/layout/AppLayout';
import Dashboard from './pages/Dashboard';
import Clients from './pages/Clients';
import WorkOrders from './pages/WorkOrders';
import CreateWorkOrder from './pages/CreateWorkOrder';
import WorkOrderDetail from './pages/WorkOrderDetail';
import MonthlyReport from './pages/MonthlyReport';
import PhotoGallery from './pages/PhotoGallery';
import Users from './pages/Users';
import Profile from './pages/Profile';
import MaterialCatalog from './pages/MaterialCatalog';
import Drawings from './pages/Drawings';
import Orders from './pages/Orders';
import Operarios from './pages/Operarios';
import GastosOperarios from './pages/GastosOperarios';
import ControlHorario from './pages/ControlHorario';
import Obras from './pages/Obras';
import CalendarioVacaciones from './pages/CalendarioVacaciones';
import Manuales from './pages/Manuales';

// Apply dark class based on system preference
function ThemeDetector() {
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const apply = (e) => document.documentElement.classList.toggle('dark', e.matches);
    apply(mq);
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, []);
  return null;
}

// Animated route wrapper
function AnimatedRoutes() {
  const location = useLocation();
  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={location.pathname}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -8 }}
        transition={{ duration: 0.18, ease: 'easeInOut' }}
        style={{ minHeight: '100%' }}
      >
        <Routes location={location}>
          <Route element={<AppLayout />}>
            <Route path="/" element={<Dashboard />} />
            <Route path="/work-orders" element={<WorkOrders />} />
            <Route path="/work-orders/new" element={<CreateWorkOrder />} />
            <Route path="/work-orders/:id" element={<WorkOrderDetail />} />
            <Route path="/clients" element={<Clients />} />
            <Route path="/reports" element={<MonthlyReport />} />
            <Route path="/photos" element={<PhotoGallery />} />
            <Route path="/users" element={<Users />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/materials" element={<MaterialCatalog />} />
            <Route path="/drawings" element={<Drawings />} />
            <Route path="/orders" element={<Orders />} />
            <Route path="/operarios" element={<Operarios />} />
            <Route path="/documentacion-operarios" element={<Operarios />} />
            <Route path="/gastos-operarios" element={<GastosOperarios />} />
            <Route path="/control-horario" element={<ControlHorario />} />
            <Route path="/obras" element={<Obras />} />
            <Route path="/calendario-vacaciones" element={<CalendarioVacaciones />} />
            <Route path="/manuales" element={<Manuales />} />
          </Route>
          <Route path="*" element={<PageNotFound />} />
        </Routes>
      </motion.div>
    </AnimatePresence>
  );
}

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError, navigateToLogin } = useAuth();

  if (isLoadingPublicSettings || isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
      </div>
    );
  }

  if (authError) {
    if (authError.type === 'user_not_registered') {
      return <UserNotRegisteredError />;
    } else if (authError.type === 'auth_required') {
      navigateToLogin();
      return null;
    }
  }

  return <AnimatedRoutes />;
};

function App() {
  return (
    <AuthProvider>
      <I18nProvider>
        <QueryClientProvider client={queryClientInstance}>
          <Router>
            <ThemeDetector />
            <AuthenticatedApp />
          </Router>
          <Toaster />
        </QueryClientProvider>
      </I18nProvider>
    </AuthProvider>
  )
}

export default App