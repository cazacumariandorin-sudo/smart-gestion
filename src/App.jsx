import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useRef } from 'react';
import { useNavDirection } from '@/hooks/useNavDirection';
import { I18nProvider } from './lib/i18n';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import AppLayout from './components/layout/AppLayout';
import ProtectedRoute from './components/ProtectedRoute';
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
import Fabricantes from './pages/Fabricantes';
import SolarPedidos from './pages/SolarPedidos';
import DatosSensibles from './pages/DatosSensibles';

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

// Animated route wrapper with directional slide
function AnimatedRoutes() {
  const location = useLocation();
  const dirRef = useNavDirection();

  const isMobileDevice = typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches;

  const variants = isMobileDevice
    ? {
        initial: (dir) => ({ opacity: 0, x: dir === 'back' ? -24 : 24 }),
        animate: { opacity: 1, x: 0 },
        exit: (dir) => ({ opacity: 0, x: dir === 'back' ? 24 : -24 }),
      }
    : {
        initial: { opacity: 0, scale: 0.98 },
        animate: { opacity: 1, scale: 1 },
        exit: { opacity: 0, scale: 0.98 },
      };

  return (
    <AnimatePresence mode="wait" custom={dirRef.current}>
      <motion.div
        key={location.pathname}
        custom={dirRef.current}
        variants={variants}
        initial="initial"
        animate="animate"
        exit="exit"
        transition={{ duration: 0.2, ease: [0.25, 0.1, 0.25, 1] }}
        style={{ minHeight: '100%' }}
      >
        <Routes location={location}>
          <Route element={<AppLayout />}>
            <Route path="/" element={<Dashboard />} />
            <Route path="/profile" element={<Profile />} />

            <Route path="/work-orders" element={<ProtectedRoute module="work-orders"><WorkOrders /></ProtectedRoute>} />
            <Route path="/work-orders/new" element={<ProtectedRoute module="work-orders"><CreateWorkOrder /></ProtectedRoute>} />
            <Route path="/work-orders/:id" element={<ProtectedRoute module="work-orders"><WorkOrderDetail /></ProtectedRoute>} />

            <Route path="/clients" element={<ProtectedRoute module="clients"><Clients /></ProtectedRoute>} />
            <Route path="/reports" element={<ProtectedRoute module="reports"><MonthlyReport /></ProtectedRoute>} />
            <Route path="/photos" element={<ProtectedRoute module="photos"><PhotoGallery /></ProtectedRoute>} />
            <Route path="/users" element={<ProtectedRoute module="users"><Users /></ProtectedRoute>} />

            <Route path="/materials" element={<ProtectedRoute module="orders"><MaterialCatalog /></ProtectedRoute>} />
            <Route path="/drawings" element={<ProtectedRoute module="orders"><Drawings /></ProtectedRoute>} />
            <Route path="/manuales" element={<ProtectedRoute module="orders"><Manuales /></ProtectedRoute>} />
            <Route path="/orders" element={<ProtectedRoute module="orders"><Orders /></ProtectedRoute>} />
            <Route path="/obras" element={<ProtectedRoute module="obras"><Obras /></ProtectedRoute>} />

            <Route path="/operarios" element={<ProtectedRoute module="operarios"><Operarios /></ProtectedRoute>} />
            <Route path="/documentacion-operarios" element={<ProtectedRoute module="operarios"><Operarios /></ProtectedRoute>} />
            <Route path="/gastos-operarios" element={<ProtectedRoute module="gastos-operarios"><GastosOperarios /></ProtectedRoute>} />
            <Route path="/control-horario" element={<ProtectedRoute module="control-horario"><ControlHorario /></ProtectedRoute>} />
            <Route path="/calendario-vacaciones" element={<ProtectedRoute module="calendario-vacaciones"><CalendarioVacaciones /></ProtectedRoute>} />

            <Route path="/fabricantes" element={<ProtectedRoute module="users"><Fabricantes /></ProtectedRoute>} />
            <Route path="/solar-pedidos" element={<ProtectedRoute module="orders"><SolarPedidos /></ProtectedRoute>} />
            <Route path="/solar-obras" element={<ProtectedRoute module="obras"><SolarPedidos /></ProtectedRoute>} />
            <Route path="/datos-sensibles" element={<ProtectedRoute module="users"><DatosSensibles /></ProtectedRoute>} />
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