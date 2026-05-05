import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useRef, lazy, Suspense } from 'react';
import { useNavDirection } from '@/hooks/useNavDirection';
import { I18nProvider } from './lib/i18n';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import AppLayout from './components/layout/AppLayout';
import ProtectedRoute from './components/ProtectedRoute';
import Dashboard from './pages/Dashboard';
import Profile from './pages/Profile';

// Lazy load pages for performance
const Clients = lazy(() => import('./pages/Clients'));
const WorkOrders = lazy(() => import('./pages/WorkOrders'));
const CreateWorkOrder = lazy(() => import('./pages/CreateWorkOrder'));
const WorkOrderDetail = lazy(() => import('./pages/WorkOrderDetail'));
const MonthlyReport = lazy(() => import('./pages/MonthlyReport'));
const PhotoGallery = lazy(() => import('./pages/PhotoGallery'));
const Users = lazy(() => import('./pages/Users'));
const MaterialCatalog = lazy(() => import('./pages/MaterialCatalog'));
const Drawings = lazy(() => import('./pages/Drawings'));
const Orders = lazy(() => import('./pages/Orders'));
const Operarios = lazy(() => import('./pages/Operarios'));
const GastosOperarios = lazy(() => import('./pages/GastosOperarios'));
const ControlHorario = lazy(() => import('./pages/ControlHorario'));
const Obras = lazy(() => import('./pages/Obras'));
const CalendarioVacaciones = lazy(() => import('./pages/CalendarioVacaciones'));
const Manuales = lazy(() => import('./pages/Manuales'));
const Fabricantes = lazy(() => import('./pages/Fabricantes'));
const AdminBackup = lazy(() => import('./pages/AdminBackup'));
const SolarPedidos = lazy(() => import('./pages/SolarPedidos'));
const DatosSensibles = lazy(() => import('./pages/DatosSensibles'));
const Inventario = lazy(() => import('./pages/Inventario'));
const DemoUsers = lazy(() => import('./pages/DemoUsers'));
const InformeObras = lazy(() => import('./pages/InformeObras'));
const NotasGastos = lazy(() => import('./pages/NotasGastos'));

// Loading fallback
const PageLoader = () => (
  <div className="fixed inset-0 flex items-center justify-center">
    <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
  </div>
);

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

            <Route path="/work-orders" element={<ProtectedRoute module="work-orders"><Suspense fallback={<PageLoader />}><WorkOrders /></Suspense></ProtectedRoute>} />
            <Route path="/work-orders/new" element={<ProtectedRoute module="work-orders"><Suspense fallback={<PageLoader />}><CreateWorkOrder /></Suspense></ProtectedRoute>} />
            <Route path="/work-orders/:id" element={<ProtectedRoute module="work-orders"><Suspense fallback={<PageLoader />}><WorkOrderDetail /></Suspense></ProtectedRoute>} />

            <Route path="/clients" element={<ProtectedRoute module="clients"><Suspense fallback={<PageLoader />}><Clients /></Suspense></ProtectedRoute>} />
            <Route path="/reports" element={<ProtectedRoute module="reports"><Suspense fallback={<PageLoader />}><MonthlyReport /></Suspense></ProtectedRoute>} />
            <Route path="/photos" element={<ProtectedRoute module="photos"><Suspense fallback={<PageLoader />}><PhotoGallery /></Suspense></ProtectedRoute>} />
            <Route path="/users" element={<ProtectedRoute module="users"><Suspense fallback={<PageLoader />}><Users /></Suspense></ProtectedRoute>} />

            <Route path="/materials" element={<ProtectedRoute module="orders"><Suspense fallback={<PageLoader />}><MaterialCatalog /></Suspense></ProtectedRoute>} />
            <Route path="/drawings" element={<ProtectedRoute module="orders"><Suspense fallback={<PageLoader />}><Drawings /></Suspense></ProtectedRoute>} />
            <Route path="/manuales" element={<ProtectedRoute module="orders"><Suspense fallback={<PageLoader />}><Manuales /></Suspense></ProtectedRoute>} />
            <Route path="/orders" element={<ProtectedRoute module="orders"><Suspense fallback={<PageLoader />}><Orders /></Suspense></ProtectedRoute>} />
            <Route path="/obras" element={<ProtectedRoute module="obras"><Suspense fallback={<PageLoader />}><Obras /></Suspense></ProtectedRoute>} />

            <Route path="/operarios" element={<ProtectedRoute module="operarios"><Suspense fallback={<PageLoader />}><Operarios /></Suspense></ProtectedRoute>} />
            <Route path="/documentacion-operarios" element={<ProtectedRoute module="operarios"><Suspense fallback={<PageLoader />}><Operarios /></Suspense></ProtectedRoute>} />
            <Route path="/gastos-operarios" element={<ProtectedRoute module="gastos-operarios"><Suspense fallback={<PageLoader />}><GastosOperarios /></Suspense></ProtectedRoute>} />
            <Route path="/control-horario" element={<ProtectedRoute module="control-horario"><Suspense fallback={<PageLoader />}><ControlHorario /></Suspense></ProtectedRoute>} />
            <Route path="/calendario-vacaciones" element={<ProtectedRoute module="calendario-vacaciones"><Suspense fallback={<PageLoader />}><CalendarioVacaciones /></Suspense></ProtectedRoute>} />

            <Route path="/fabricantes" element={<ProtectedRoute module="users"><Suspense fallback={<PageLoader />}><Fabricantes /></Suspense></ProtectedRoute>} />
            <Route path="/admin-backup" element={<ProtectedRoute module="users"><Suspense fallback={<PageLoader />}><AdminBackup /></Suspense></ProtectedRoute>} />
            <Route path="/solar-pedidos" element={<ProtectedRoute module="orders"><Suspense fallback={<PageLoader />}><SolarPedidos /></Suspense></ProtectedRoute>} />
            <Route path="/solar-obras" element={<ProtectedRoute module="obras"><Suspense fallback={<PageLoader />}><SolarPedidos /></Suspense></ProtectedRoute>} />
            <Route path="/datos-sensibles" element={<ProtectedRoute module="users"><Suspense fallback={<PageLoader />}><DatosSensibles /></Suspense></ProtectedRoute>} />
            <Route path="/inventario" element={<ProtectedRoute module="users"><Suspense fallback={<PageLoader />}><Inventario /></Suspense></ProtectedRoute>} />
            <Route path="/demo-users" element={<ProtectedRoute module="users"><Suspense fallback={<PageLoader />}><DemoUsers /></Suspense></ProtectedRoute>} />
            <Route path="/informe-obras" element={<ProtectedRoute module="informe-obras"><Suspense fallback={<PageLoader />}><InformeObras /></Suspense></ProtectedRoute>} />
            <Route path="/notas-gastos" element={<ProtectedRoute module="gastos-operarios"><Suspense fallback={<PageLoader />}><NotasGastos /></Suspense></ProtectedRoute>} />
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