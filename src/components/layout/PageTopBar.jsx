/**
 * PageTopBar — franja de indicadores bajo el PageHeader (z-40, por debajo del header z-50).
 * Agrupa el estado de red y el botón flotante de "volver" para pantallas bloqueadas.
 * Colocar justo después del PageHeader en cada página.
 */
import NetworkStatusBanner from '@/components/layout/NetworkStatusBanner';
import FloatingBackButton from '@/components/FloatingBackButton';

export default function PageTopBar({ isLoading, error }) {
  return (
    <div
      className="sticky top-14 z-40"
      style={{
        paddingLeft: 'env(safe-area-inset-left, 0px)',
        paddingRight: 'env(safe-area-inset-right, 0px)',
      }}
    >
      <NetworkStatusBanner />
      <FloatingBackButton show={!!isLoading || !!error} />
    </div>
  );
}