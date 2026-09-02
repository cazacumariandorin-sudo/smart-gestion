import { useState } from 'react';
import { FileText, Upload, List, BarChart2 } from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';
import PageHeader from '@/components/layout/PageHeader';
import CargaNominasForm from '@/components/nominas/CargaNominasForm';
import ResultadoProcesamiento from '@/components/nominas/ResultadoProcesamiento';
import ListaNominas from '@/components/nominas/ListaNominas';
import AnalisisCostes from '@/components/nominas/AnalisisCostes';
import NominasErrorBoundary from '@/components/nominas/NominasErrorBoundary';

export default function Nominas() {
  const { user } = useAuth();
  const [tab, setTab] = useState('lista');
  const [resultado, setResultado] = useState(null);

  const isAdmin = ['admin', 'gerencia'].includes(user?.role);

  const handleResultado = (res) => {
    setResultado(res);
    if (!res.error) setTab('resultado');
  };

  return (
    <div className="min-h-screen bg-background">
      <PageHeader title="Nóminas" subtitle="Gestión y consulta de nóminas" />

      <NominasErrorBoundary>
        <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
          {/* Tabs */}
          <div className="flex gap-1 bg-muted/50 rounded-xl p-1">
            <button
              onClick={() => setTab('lista')}
              className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium transition-all
                ${tab === 'lista' ? 'bg-card shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
            >
              <List className="w-4 h-4" /> Nóminas
            </button>
            {isAdmin && (
              <button
                onClick={() => setTab('analisis')}
                className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium transition-all
                  ${tab === 'analisis' ? 'bg-card shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
              >
                <BarChart2 className="w-4 h-4" /> Costes
              </button>
            )}
            {isAdmin && (
              <button
                onClick={() => setTab('carga')}
                className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium transition-all
                  ${tab === 'carga' || tab === 'resultado' ? 'bg-card shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
              >
                <Upload className="w-4 h-4" /> Cargar
              </button>
            )}
          </div>

          {/* Tab: Análisis de costes */}
          {tab === 'analisis' && isAdmin && (
            <div className="bg-card border border-border rounded-2xl p-5">
              <AnalisisCostes />
            </div>
          )}

          {/* Tab: Lista */}
          {tab === 'lista' && (
            <div className="bg-card border border-border rounded-2xl p-5">
              <ListaNominas esAdmin={isAdmin} />
            </div>
          )}

          {/* Tab: Carga */}
          {tab === 'carga' && isAdmin && (
            <div className="bg-card border border-border rounded-2xl p-5 space-y-4">
              <div>
                <h2 className="font-semibold text-base flex items-center gap-2">
                  <FileText className="w-5 h-5 text-primary" />
                  Cargar PDF de nóminas
                </h2>
                <p className="text-xs text-muted-foreground mt-1">
                  Sube el PDF completo de la gestoría. El sistema identificará automáticamente cada trabajador por nombre y DNI.
                </p>
              </div>
              <CargaNominasForm onResultado={handleResultado} />
            </div>
          )}

          {/* Tab: Resultado */}
          {tab === 'resultado' && resultado && (
            <div className="bg-card border border-border rounded-2xl p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="font-semibold text-base">Resultado del procesamiento</h2>
                <button
                  onClick={() => { setTab('carga'); setResultado(null); }}
                  className="text-xs text-primary hover:underline"
                >
                  Nueva carga
                </button>
              </div>
              <ResultadoProcesamiento resultado={resultado} />
              <button
                onClick={() => setTab('lista')}
                className="w-full text-center text-sm text-primary hover:underline pt-2"
              >
                Ver todas las nóminas →
              </button>
            </div>
          )}

          {/* Info para trabajadores */}
          {!isAdmin && (
            <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 text-sm text-muted-foreground">
              <p className="font-medium text-foreground mb-1">Tus nóminas</p>
              <p>Aquí puedes consultar y descargar tus nóminas. Son accesibles solo para ti.</p>
            </div>
          )}
        </div>
      </NominasErrorBoundary>
    </div>
  );
}