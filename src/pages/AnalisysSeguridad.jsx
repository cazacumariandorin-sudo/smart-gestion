import { useState } from 'react';
import { AlertCircle, Lock, Eye } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import PageHeader from '@/components/layout/PageHeader';

export default function AnalisisSeguridad() {
  const [expandedProblems, setExpandedProblems] = useState({});

  const toggleExpand = (id) => {
    setExpandedProblems(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  const problemasRLS = [
    {
      id: 'rls-1',
      entidad: 'NotificacionFichaje',
      severidad: 'Crítico',
      problema: 'No tiene reglas RLS',
      descripcion: 'La regla de creación actual no es funcional ya que compara un ID de operario con un ID de usuario. La creación de estas notificaciones debe estar restringida.',
      impacto: 'Acceso no autorizado a notificaciones de otros usuarios',
      solucion: 'Añadir RLS que verifique que el usuario pueda crear notificaciones solo para su operario vinculado',
      archivo: 'entities/NotificacionFichaje.json'
    },
    {
      id: 'rls-2',
      entidad: 'RegistroGasto',
      severidad: 'Crítico',
      problema: 'Error en sintaxis RLS',
      descripcion: 'La regla de eliminación contiene un error de sintaxis (created_condition) que la invalida. Se corrige para que use user_condition.',
      impacto: 'Regla RLS no aplicada, posible acceso no autorizado',
      solucion: 'Corregir la sintaxis en la regla de eliminación usando user_condition en lugar de created_condition',
      archivo: 'entities/RegistroGasto.json'
    }
  ];

  const problemasBackend = [
    {
      id: 'backend-1',
      funcion: 'generarUsuarioIdPersonalizado',
      severidad: 'Alto',
      problema: 'Autenticación requerida sin verificación de rol explícita',
      descripcion: 'La función requiere autenticación pero no verifica explícitamente el rol del usuario. Aunque se llama desde inviteUserFunction que sí tiene verificación, no hay validación de rol en esta función.',
      impacto: 'Usuarios autenticados podrían potencialmente generar IDs personalizados para otros',
      solucion: 'Añadir verificación explícita de rol (admin/director_comercial)',
      archivo: 'functions/generarUsuarioIdPersonalizado.js'
    },
    {
      id: 'backend-2',
      funcion: 'createGdriveFolderStructure',
      severidad: 'Alto',
      problema: 'Autenticación requerida sin verificación de rol específica',
      descripcion: 'La función requiere autenticación pero no realiza una verificación de rol específica. Si la intención es que solo administradores configuren la estructura de Google Drive, debe estar restringida.',
      impacto: 'Usuarios no autorizados podrían modificar la estructura de carpetas en Google Drive',
      solucion: 'Añadir verificación de rol admin y verificación de permisos explícita',
      archivo: 'functions/createGdriveFolderStructure.js'
    },
    {
      id: 'backend-3',
      funcion: 'uploadFileToGdrive',
      severidad: 'Alto',
      problema: 'Autenticación requerida sin verificación de rol específica',
      descripcion: 'La función requiere autenticación pero no incluye una verificación de rol específica. Si la subida de archivos a Google Drive debe estar restringida a ciertos roles, no se verifica.',
      impacto: 'Cualquier usuario autenticado podría subir archivos a Google Drive',
      solucion: 'Añadir verificación de roles permitidos según el contexto de uso',
      archivo: 'functions/uploadFileToGdrive.js'
    }
  ];

  const ProblemCard = ({ problem }) => (
    <Card className="mb-4 border-l-4 border-l-destructive">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <AlertCircle className="w-5 h-5 text-destructive shrink-0" />
              <CardTitle className="text-base">
                {problem.entidad || problem.funcion}
              </CardTitle>
              <Badge variant="destructive" className="ml-auto">
                {problem.severidad}
              </Badge>
            </div>
            <CardDescription className="text-sm font-medium">
              {problem.problema}
            </CardDescription>
          </div>
          <button
            onClick={() => toggleExpand(problem.id)}
            className="text-muted-foreground hover:text-foreground text-sm font-medium"
          >
            {expandedProblems[problem.id] ? '−' : '+'}
          </button>
        </div>
      </CardHeader>

      {expandedProblems[problem.id] && (
        <CardContent className="space-y-3 text-sm">
          <div className="space-y-2 pb-3 border-b">
            <h4 className="font-semibold text-foreground">Descripción</h4>
            <p className="text-muted-foreground">{problem.descripcion}</p>
          </div>

          <div className="space-y-2 pb-3 border-b">
            <h4 className="font-semibold text-foreground flex items-center gap-2">
              <AlertCircle className="w-4 h-4" />
              Impacto
            </h4>
            <p className="text-destructive/90 font-medium">{problem.impacto}</p>
          </div>

          <div className="space-y-2 pb-3 border-b">
            <h4 className="font-semibold text-foreground flex items-center gap-2">
              <Lock className="w-4 h-4" />
              Solución Propuesta
            </h4>
            <p className="text-muted-foreground">{problem.solucion}</p>
          </div>

          <div className="space-y-2">
            <h4 className="font-semibold text-foreground flex items-center gap-2">
              <Eye className="w-4 h-4" />
              Archivo
            </h4>
            <code className="block bg-muted px-3 py-2 rounded text-xs overflow-x-auto">
              {problem.archivo}
            </code>
          </div>
        </CardContent>
      )}
    </Card>
  );

  return (
    <div>
      <PageHeader title="Análisis de Seguridad" />

      <div className="p-4 space-y-6">
        <div className="rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900 p-4">
          <p className="text-sm text-amber-900 dark:text-amber-200">
            <strong>Estado:</strong> Análisis de problemas detectados. Se requiere revisión y aprobación antes de implementar correcciones.
          </p>
        </div>

        <Tabs defaultValue="rls" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4" />
              RLS {problemasRLS.length}
            </TabsTrigger>
            <TabsTrigger className="flex items-center gap-2">
              <Lock className="w-4 h-4" />
              Backend {problemasBackend.length}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="rls" className="space-y-4 mt-4">
            <div className="text-sm text-muted-foreground mb-4">
              Problemas de seguridad en reglas de Row-Level Security (RLS) a nivel de entidad
            </div>
            {problemasRLS.map(problem => (
              <ProblemCard key={problem.id} problem={problem} />
            ))}
          </TabsContent>

          <TabsContent value="backend" className="space-y-4 mt-4">
            <div className="text-sm text-muted-foreground mb-4">
              Problemas de autenticación y autorización en funciones backend
            </div>
            {problemasBackend.map(problem => (
              <ProblemCard key={problem.id} problem={problem} />
            ))}
          </TabsContent>
        </Tabs>

        <Card className="bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-900">
          <CardHeader>
            <CardTitle className="text-base">Resumen</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p>
              <strong>Total de problemas:</strong> {problemasRLS.length + problemasBackend.length}
            </p>
            <p>
              <strong>Críticos (RLS):</strong> {problemasRLS.length}
            </p>
            <p>
              <strong>Altos (Backend):</strong> {problemasBackend.length}
            </p>
            <p className="text-muted-foreground mt-3">
              Haz clic en cada problema para ver descripción completa, impacto y solución propuesta.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}