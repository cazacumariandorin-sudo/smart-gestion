import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AlertCircle, CheckCircle2, XCircle, Users, FlaskConical, AlertTriangle } from 'lucide-react';
import PageHeader from '@/components/layout/PageHeader';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export default function DiagnosticoDuplicacion() {
  const [filtro, setFiltro] = useState('todos');

  const { data: users = [], isLoading } = useQuery({
    queryKey: ['diagnostico-users'],
    queryFn: () => base44.entities.User.list('email', 500),
  });

  // Clasificación CORRECTA de usuarios
  const usuariosReales = users.filter(u => 
    u.tipo_cuenta === 'real' || 
    (u.role !== 'usuario_demo' && !u.demo_expires_at && !u.acceso_total_hasta)
  );

  const usuariosDemo = users.filter(u => 
    u.tipo_cuenta === 'demo' || 
    u.role === 'usuario_demo' || 
    u.demo_expires_at || 
    u.acceso_total_hasta
  );

  // Posibles duplicados: mismos emails en ambas listas
  const emailsReales = new Set(usuariosReales.map(u => u.email.toLowerCase()));
  const emailsDemo = new Set(usuariosDemo.map(u => u.email.toLowerCase()));
  const emailsDuplicados = [...emailsReales].filter(email => emailsDemo.has(email));

  // Usuarios con datos inconsistentes
  const inconsistentes = users.filter(u => {
    // Tiene tipo_cuenta demo pero rol real
    if (u.tipo_cuenta === 'demo' && u.role !== 'usuario_demo' && !u.demo_expires_at && !u.acceso_total_hasta) {
      return true;
    }
    // Tiene tipo_cuenta real pero tiene demo_expires_at
    if (u.tipo_cuenta === 'real' && (u.demo_expires_at || u.role === 'usuario_demo')) {
      return true;
    }
    return false;
  });

  const stats = {
    total: users.length,
    reales: usuariosReales.length,
    demo: usuariosDemo.length,
    duplicados: emailsDuplicados.length,
    inconsistentes: inconsistentes.length,
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader title="Diagnóstico de Duplicación" />

      <div className="p-4 sm:p-6 space-y-6 max-w-6xl mx-auto">
        {/* Alerta de duplicados */}
        {emailsDuplicados.length > 0 && (
          <Card className="border-l-4 border-l-destructive bg-destructive/5">
            <CardHeader>
              <div className="flex items-center gap-3">
                <AlertCircle className="w-6 h-6 text-destructive" />
                <div>
                  <CardTitle className="text-base text-destructive">
                    ⚠ {emailsDuplicados.length} usuario(s) duplicado(s) detectado(s)
                  </CardTitle>
                  <CardDescription>
                    Los mismos emails aparecen en usuarios reales y demo
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {emailsDuplicados.slice(0, 10).map(email => (
                  <Badge key={email} variant="destructive" className="text-xs">
                    {email}
                  </Badge>
                ))}
                {emailsDuplicados.length > 10 && (
                  <Badge variant="outline" className="text-xs">
                    +{emailsDuplicados.length - 10} más
                  </Badge>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Alerta de inconsistentes */}
        {inconsistentes.length > 0 && (
          <Card className="border-l-4 border-l-amber-500 bg-amber-500/5">
            <CardHeader>
              <div className="flex items-center gap-3">
                <AlertTriangle className="w-6 h-6 text-amber-500" />
                <div>
                  <CardTitle className="text-base text-amber-600">
                    {inconsistentes.length} usuario(s) con datos inconsistentes
                  </CardTitle>
                  <CardDescription>
                    Tienen conflictos entre tipo_cuenta, role y campos demo
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 text-xs">
                {inconsistentes.slice(0, 5).map(u => (
                  <div key={u.id} className="flex items-center gap-2">
                    <Badge variant="outline" className="text-[10px]">
                      {u.email}
                    </Badge>
                    <span className="text-muted-foreground">
                      tipo: {u.tipo_cuenta || '—'}, role: {u.role}
                      {u.demo_expires_at && ' (tiene demo_expires_at)'}
                      {u.acceso_total_hasta && ' (tiene acceso_total_hasta)'}
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          <Card>
            <CardContent className="pt-4 text-center">
              <p className="text-2xl font-bold">{stats.total}</p>
              <p className="text-xs text-muted-foreground mt-1">Total</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 text-center">
              <p className="text-2xl font-bold text-blue-600">{stats.reales}</p>
              <p className="text-xs text-muted-foreground mt-1">Reales</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 text-center">
              <p className="text-2xl font-bold text-amber-600">{stats.demo}</p>
              <p className="text-xs text-muted-foreground mt-1">Demo</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 text-center">
              <p className="text-2xl font-bold text-destructive">{stats.duplicados}</p>
              <p className="text-xs text-muted-foreground mt-1">Duplicados</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 text-center">
              <p className="text-2xl font-bold text-amber-600">{stats.inconsistentes}</p>
              <p className="text-xs text-muted-foreground mt-1">Inconsistentes</p>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs value={filtro} onValueChange={setFiltro}>
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="todos">Todos ({stats.total})</TabsTrigger>
            <TabsTrigger value="reales">Reales ({stats.reales})</TabsTrigger>
            <TabsTrigger value="demo">Demo ({stats.demo})</TabsTrigger>
            <TabsTrigger value="problemas">
              Problemas ({stats.duplicados + stats.inconsistentes})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="todos" className="space-y-2 mt-4">
            {users.map(u => (
              <UserCard key={u.id} user={u} tipo="clasificacion" />
            ))}
          </TabsContent>

          <TabsContent value="reales" className="space-y-2 mt-4">
            {usuariosReales.map(u => (
              <UserCard key={u.id} user={u} tipo="real" />
            ))}
          </TabsContent>

          <TabsContent value="demo" className="space-y-2 mt-4">
            {usuariosDemo.map(u => (
              <UserCard key={u.id} user={u} tipo="demo" />
            ))}
          </TabsContent>

          <TabsContent value="problemas" className="space-y-2 mt-4">
            {[...emailsDuplicados, ...inconsistentes.map(u => u.email)].length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <CheckCircle2 className="w-12 h-12 mx-auto mb-3 text-green-500" />
                <p>No se encontraron problemas</p>
              </div>
            ) : (
              <>
                {emailsDuplicados.length > 0 && (
                  <div>
                    <h3 className="text-sm font-semibold mb-2 flex items-center gap-2 text-destructive">
                      <XCircle className="w-4 h-4" /> Emails Duplicados
                    </h3>
                    {users.filter(u => emailsDuplicados.includes(u.email.toLowerCase())).map(u => (
                      <UserCard key={u.id} user={u} tipo="duplicado" />
                    ))}
                  </div>
                )}
                {inconsistentes.length > 0 && (
                  <div>
                    <h3 className="text-sm font-semibold mb-2 flex items-center gap-2 text-amber-600">
                      <AlertTriangle className="w-4 h-4" /> Datos Inconsistentes
                    </h3>
                    {inconsistentes.map(u => (
                      <UserCard key={u.id} user={u} tipo="inconsistente" />
                    ))}
                  </div>
                )}
              </>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

function UserCard({ user, tipo }) {
  const esDuplicado = tipo === 'duplicado';
  const esInconsistente = tipo === 'inconsistente';

  return (
    <Card className={`border-l-4 ${
      esDuplicado ? 'border-l-destructive bg-destructive/5' :
      esInconsistente ? 'border-l-amber-500 bg-amber-500/5' :
      tipo === 'real' ? 'border-l-blue-500' :
      tipo === 'demo' ? 'border-l-amber-500' :
      'border-l-border'
    }`}>
      <CardContent className="p-3">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-sm font-semibold truncate">{user.email}</p>
              {tipo === 'real' && <Badge className="text-[10px] bg-blue-500">Real</Badge>}
              {tipo === 'demo' && <Badge className="text-[10px] bg-amber-500">Demo</Badge>}
              {esDuplicado && <Badge variant="destructive" className="text-[10px]">Duplicado</Badge>}
              {esInconsistente && <Badge variant="outline" className="text-[10px] text-amber-600 border-amber-600">Inconsistente</Badge>}
            </div>
            <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground flex-wrap">
              <span>Nombre: {user.full_name || '—'}</span>
              <span>•</span>
              <span>Role: <Badge variant="outline" className="text-[10px]">{user.role}</Badge></span>
              <span>•</span>
              <span>Tipo: <Badge variant="outline" className="text-[10px]">{user.tipo_cuenta || '—'}</Badge></span>
              {user.demo_expires_at && (
                <>
                  <span>•</span>
                  <span className="text-amber-600">Demo expires: {user.demo_expires_at}</span>
                </>
              )}
              {user.acceso_total_hasta && (
                <>
                  <span>•</span>
                  <span className="text-amber-600">Acceso hasta: {user.acceso_total_hasta}</span>
                </>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}