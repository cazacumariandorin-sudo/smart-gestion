import { Toaster } from "@/components/ui/toaster"
import { Navigate } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useRef, lazy, Suspense } from 'react';
import { useNavDirection } from '@/hooks/useNavDirection';
import { processOfflineQueue, getQueue } from '@/utils/offlineQueue';
import { preloadOfflineCache } from '@/hooks/useOfflineCache';
import { recalcularPrevision } from '@/hooks/useRecalcularPrevision';
import { base44 } from '@/api/base44Client';
import { I18nProvider } from './lib/i18n';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import AppLayout from './components/layout/AppLayout';
import ProtectedRoute from './components/ProtectedRoute';
import Dashboard from './pages/Dashboard';
import Profile from './pages/Profile';
import Login from './pages/Login';
import Register from './pages/Register';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';

// Lazy load pages for performance
const Clients = lazy(() => import('./pages/Clients'));
const WorkOrders = lazy(() => import('./pages/WorkOrders'));
const CreateWorkOrder = lazy(() => import('./pages/CreateWorkOrder'));
const WorkOrderDetail = lazy(() => import('./pages/WorkOrderDetail'));
const MonthlyReport = lazy(() => import('./pages/MonthlyReport'));
const PhotoGallery = lazy(() => import('./pages/PhotoGallery'));
const Users = lazy(() => import('./pages/UsersPage'));
const MaterialCatalog = lazy(() => import('./pages/MaterialCatalog'));
const Drawings = lazy(() => import('./pages/Drawings'));
const Orders = lazy(() => import('./pages/Orders'));
const Tecnicos = lazy(() => import('./pages/Tecnicos'));
const ControlHorario = lazy(() => import('./pages/ControlHorario'));
const ObrasCiviles = lazy(() => import('./pages/ObrasCiviles'));
const CalendarioVacaciones = lazy(() => import('./pages/CalendarioVacaciones'));
const Manuales = lazy(() => import('./pages/Manuales'));
const Fabricantes = lazy(() => import('./pages/Fabricantes'));
const AdminBackup = lazy(() => import('./pages/AdminBackup'));
const Solar = lazy(() => import('./pages/Solar'));
const DatosSensibles = lazy(() => import('./pages/DatosSensibles'));
const Inventario = lazy(() => import('./pages/Inventario'));
const DemoUsers = lazy(() => import('./pages/DemoUsers'));
const InvitacionesDemo = lazy(() => import('./pages/InvitacionesDemo'));
const DemoJoin = lazy(() => import('./pages/DemoJoin'));
const InformeObras = lazy(() => import('./pages/InformeObras'));
const NotasGastos = lazy(() => import('./pages/NotasGastos'));
const Chat = lazy(() => import('./pages/Chat'));
const Flota = lazy(() => import('./pages/Flota'));
const GaleriaFotos = lazy(() => import('./pages/GaleriaFotos'));
const ApuntesHorario = lazy(() => import('./pages/ApuntesHorario'));
const PrevisionObras = lazy(() => import('./pages/PrevisionObras'));
const SimuladorRoles = lazy(() => import('./pages/SimuladorRoles'));
const DiagnosticoTecnico = lazy(() => import('./pages/DiagnosticoTecnico'));
const DiagnosticoOperario = lazy(() => import('./pages/DiagnosticoOperario'));
const DiagnosticoDuplicacion = lazy(() => import('./pages/DiagnosticoDuplicacion'));
const VinculacionPage = lazy(() => import('./pages/Vinculacion'));
const AnalisisSeguridad = lazy(() => import('./pages/AnalisysSeguridad'));
const Nominas = lazy(() => import('./pages/Nominas'));
const Presupuestos = lazy(() => import('./pages/Presupuestos'));
const ReglasDeOro = lazy(() => import('./pages/ReglasDeOro'));

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

// BLOQUE 6 — Detección de capacidades del dispositivo y polyfills
function DeviceCapabilityDetector() {
  useEffect(() => {
    const ua = navigator.userAgent;

    // Detectar versión Android y aplicar polyfills si es antigua
    const androidMatch = ua.match(/Android\s([0-9.]+)/);
    const androidVersion = androidMatch ? parseFloat(androidMatch[1]) : null;
    if (androidVersion && androidVersion < 5) {
      document.documentElement.style.setProperty('--sg-touch-target', '44px');
      document.documentElement.style.setProperty('--sg-content-padding', '12px');
    }

    // Fallback para navegadores sin CSS Grid
    if (typeof CSS !== 'undefined' && CSS.supports && !CSS.supports('display', 'grid')) {
      document.body.classList.add('no-grid');
    }

    // Orientación y tipo de dispositivo
    const updateDevice = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      document.body.classList.toggle('landscape', w > h);
      document.body.classList.toggle('portrait', w <= h);
      document.body.classList.toggle('is-tablet', w >= 768);
      document.body.classList.toggle('is-mobile', w < 768);
    };
    updateDevice();
    window.addEventListener('resize', updateDevice);
    window.addEventListener('orientationchange', updateDevice);
    return () => {
      window.removeEventListener('resize', updateDevice);
      window.removeEventListener('orientationchange', updateDevice);
    };
  }, []);
  return null;
}

// Precarga en background los datos críticos para uso offline
function OfflinePrecacher() {
  useEffect(() => {
    if (navigator.onLine) {
      preloadOfflineCache(base44).catch(() => {});
    }
    const handleOnline = () => preloadOfflineCache(base44).catch(() => {});
    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, []);
  return null;
}

// Procesa la cola offline cuando se recupera la conexión
function OfflineQueueProcessor() {
  useEffect(() => {
    const handleOnline = async () => {
      const pendingQueue = getQueue();
      if (pendingQueue.length === 0) return;
      const entityApis = {
        Fichaje: base44.entities.Fichaje,
        WorkOrder: base44.entities.WorkOrder,
        RegistroGasto: base44.entities.RegistroGasto,
        ApunteHorario: base44.entities.ApunteHorario,
        ObraMaterial: base44.entities.ObraMaterial,
      };

      const fichajesConObra = pendingQueue.filter(i => i.entityName === 'Fichaje' && i.payload?.obra_id);
      await processOfflineQueue(entityApis);
      const obraIds = [...new Set(fichajesConObra.map(i => i.payload.obra_id))];
      for (const obraId of obraIds) {
        const obraName = fichajesConObra.find(i => i.payload.obra_id === obraId)?.payload?.obra_name || '';
        await recalcularPrevision(obraId, obraName).catch(() => {});
      }
    };
    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
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
            <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
            <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />

            <Route path="/work-orders" element={<ProtectedRoute module="work-orders"><Suspense fallback={<PageLoader />}><WorkOrders /></Suspense></ProtectedRoute>} />
            <Route path="/work-orders/new" element={<ProtectedRoute module="work-orders"><Suspense fallback={<PageLoader />}><CreateWorkOrder /></Suspense></ProtectedRoute>} />
            <Route path="/work-orders/:id" element={<ProtectedRoute module="work-orders"><Suspense fallback={<PageLoader />}><WorkOrderDetail /></Suspense></ProtectedRoute>} />

            <Route path="/clients" element={<ProtectedRoute module="clients"><Suspense fallback={<PageLoader />}><Clients /></Suspense></ProtectedRoute>} />
            <Route path="/reports" element={<ProtectedRoute module="reports"><Suspense fallback={<PageLoader />}><MonthlyReport /></Suspense></ProtectedRoute>} />
            <Route path="/photos" element={<ProtectedRoute module="photos"><Suspense fallback={<PageLoader />}><PhotoGallery /></Suspense></ProtectedRoute>} />
            <Route path="/users" element={<ProtectedRoute module="users"><Suspense fallback={<PageLoader />}><Users /></Suspense></ProtectedRoute>} />

            <Route path="/materials" element={<ProtectedRoute module="orders"><Suspense fallback={<PageLoader />}><MaterialCatalog /></Suspense></ProtectedRoute>} />
            <Route path="/drawings" element={<ProtectedRoute module="drawings"><Suspense fallback={<PageLoader />}><Drawings /></Suspense></ProtectedRoute>} />
            <Route path="/manuales" element={<ProtectedRoute module="manuales"><Suspense fallback={<PageLoader />}><Manuales /></Suspense></ProtectedRoute>} />
            <Route path="/orders" element={<ProtectedRoute module="orders"><Suspense fallback={<PageLoader />}><Orders /></Suspense></ProtectedRoute>} />

            {/* OBRAS CIVILES - Separate entity with own permissions */}
            <Route path="/obras-civiles" element={<ProtectedRoute module="obras-civiles"><Suspense fallback={<PageLoader />}><ObrasCiviles /></Suspense></ProtectedRoute>} />

            {/* SOLAR - Integrated solar project management with sub-modules */}
            <Route path="/solar" element={<ProtectedRoute module="solar"><Suspense fallback={<PageLoader />}><Solar /></Suspense></ProtectedRoute>} />

            <Route path="/operarios" element={<ProtectedRoute module="operarios"><Suspense fallback={<PageLoader />}><Tecnicos /></Suspense></ProtectedRoute>} />
            <Route path="/documentacion-operarios" element={<ProtectedRoute module="operarios"><Suspense fallback={<PageLoader />}><Tecnicos /></Suspense></ProtectedRoute>} />
            <Route path="/control-horario" element={<ProtectedRoute module="control-horario"><Suspense fallback={<PageLoader />}><ControlHorario /></Suspense></ProtectedRoute>} />
            <Route path="/calendario-vacaciones" element={<ProtectedRoute module="calendario-vacaciones"><Suspense fallback={<PageLoader />}><CalendarioVacaciones /></Suspense></ProtectedRoute>} />

            <Route path="/fabricantes" element={<ProtectedRoute module="users"><Suspense fallback={<PageLoader />}><Fabricantes /></Suspense></ProtectedRoute>} />
            <Route path="/admin-backup" element={<ProtectedRoute module="users"><Suspense fallback={<PageLoader />}><AdminBackup /></Suspense></ProtectedRoute>} />
            <Route path="/datos-sensibles" element={<ProtectedRoute module="users"><Suspense fallback={<PageLoader />}><DatosSensibles /></Suspense></ProtectedRoute>} />
            <Route path="/inventario" element={<ProtectedRoute module="users"><Suspense fallback={<PageLoader />}><Inventario /></Suspense></ProtectedRoute>} />
            <Route path="/demo-users" element={<ProtectedRoute module="users"><Suspense fallback={<PageLoader />}><DemoUsers /></Suspense></ProtectedRoute>} />
            <Route path="/informe-obras" element={<ProtectedRoute module="informe-obras"><Suspense fallback={<PageLoader />}><InformeObras /></Suspense></ProtectedRoute>} />
            <Route path="/notas-gastos" element={<ProtectedRoute module="notas-gastos"><Suspense fallback={<PageLoader />}><NotasGastos /></Suspense></ProtectedRoute>} />
            <Route path="/chat" element={<ProtectedRoute module="chat"><Suspense fallback={<PageLoader />}><Chat /></Suspense></ProtectedRoute>} />
            <Route path="/flota" element={<ProtectedRoute module="flota"><Suspense fallback={<PageLoader />}><Flota /></Suspense></ProtectedRoute>} />
            <Route path="/galeria-fotos" element={<ProtectedRoute module="galeria-fotos"><Suspense fallback={<PageLoader />}><GaleriaFotos /></Suspense></ProtectedRoute>} />
            <Route path="/apuntes-horario" element={<ProtectedRoute module="apuntes-horario"><Suspense fallback={<PageLoader />}><ApuntesHorario /></Suspense></ProtectedRoute>} />
            <Route path="/prevision-obras" element={<ProtectedRoute module="informe-obras"><Suspense fallback={<PageLoader />}><PrevisionObras /></Suspense></ProtectedRoute>} />
            <Route path="/invitaciones-demo" element={<ProtectedRoute module="users"><Suspense fallback={<PageLoader />}><InvitacionesDemo /></Suspense></ProtectedRoute>} />
            <Route path="/simulador-roles" element={<ProtectedRoute module="users"><Suspense fallback={<PageLoader />}><SimuladorRoles /></Suspense></ProtectedRoute>} />
            <Route path="/diagnostico-tecnico" element={<ProtectedRoute module="users"><Suspense fallback={<PageLoader />}><DiagnosticoTecnico /></Suspense></ProtectedRoute>} />
            <Route path="/diagnostico-duplicacion" element={<ProtectedRoute module="users"><Suspense fallback={<PageLoader />}><DiagnosticoDuplicacion /></Suspense></ProtectedRoute>} />
            <Route path="/vinculacion" element={<ProtectedRoute module="users"><Suspense fallback={<PageLoader />}><VinculacionPage /></Suspense></ProtectedRoute>} />
            <Route path="/analisis-seguridad" element={<ProtectedRoute module="users"><Suspense fallback={<PageLoader />}><AnalisisSeguridad /></Suspense></ProtectedRoute>} />
            <Route path="/nominas" element={<ProtectedRoute module="nominas"><Suspense fallback={<PageLoader />}><Nominas /></Suspense></ProtectedRoute>} />
            <Route path="/presupuestos" element={<ProtectedRoute module="economico"><Suspense fallback={<PageLoader />}><Presupuestos /></Suspense></ProtectedRoute>} />
            <Route path="/sistema/reglas-de-oro" element={<ProtectedRoute module="users"><Suspense fallback={<PageLoader />}><ReglasDeOro /></Suspense></ProtectedRoute>} />
          </Route>
          <Route path="/demo-join" element={<Suspense fallback={<PageLoader />}><DemoJoin /></Suspense>} />

          {/* Auth pages — public */}
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />

          {/* Legacy PascalCase redirects */}
          <Route path="/AdminBackup" element={<Navigate to="/admin-backup" replace />} />
          <Route path="/CalendarioVacaciones" element={<Navigate to="/calendario-vacaciones" replace />} />
          <Route path="/Clients" element={<Navigate to="/clients" replace />} />
          <Route path="/ControlHorario" element={<Navigate to="/control-horario" replace />} />
          <Route path="/CreateWorkOrder" element={<Navigate to="/work-orders/new" replace />} />
          <Route path="/DatosSensibles" element={<Navigate to="/datos-sensibles" replace />} />
          <Route path="/DemoUsers" element={<Navigate to="/demo-users" replace />} />
          <Route path="/Drawings" element={<Navigate to="/drawings" replace />} />
          <Route path="/Fabricantes" element={<Navigate to="/fabricantes" replace />} />
          <Route path="/GastosOperarios" element={<Navigate to="/notas-gastos" replace />} />
          <Route path="/InformeObras" element={<Navigate to="/informe-obras" replace />} />
          <Route path="/Inventario" element={<Navigate to="/inventario" replace />} />
          <Route path="/Manuales" element={<Navigate to="/manuales" replace />} />
          <Route path="/MaterialCatalog" element={<Navigate to="/materials" replace />} />
          <Route path="/MonthlyReport" element={<Navigate to="/reports" replace />} />
          <Route path="/Obras" element={<Navigate to="/obras-civiles" replace />} />
          <Route path="/Operarios" element={<Navigate to="/operarios" replace />} />
          <Route path="/Tecnicos" element={<Navigate to="/operarios" replace />} />
          <Route path="/tecnicos" element={<Navigate to="/operarios" replace />} />
          <Route path="/DiagnosticoTecnico" element={<Navigate to="/diagnostico-tecnico" replace />} />
          <Route path="/Orders" element={<Navigate to="/orders" replace />} />
          <Route path="/PhotoGallery" element={<Navigate to="/photos" replace />} />
          <Route path="/Profile" element={<Navigate to="/profile" replace />} />
          <Route path="/SolarPedidos" element={<Navigate to="/solar" replace />} />
          <Route path="/WorkOrders" element={<Navigate to="/work-orders" replace />} />
          <Route path="/NotasGastos" element={<Navigate to="/notas-gastos" replace />} />

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
      // Redirect handled by ProtectedRoute / AnimatedRoutes
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
            <DeviceCapabilityDetector />
            <OfflineQueueProcessor />
            <OfflinePrecacher />
            <AuthenticatedApp />
          </Router>
          <Toaster />
        </QueryClientProvider>
      </I18nProvider>
    </AuthProvider>
  )
}

export default App