import { Loader2 } from 'lucide-react';

export default function PullToRefreshIndicator({ pullDistance, refreshing, threshold = 70 }) {
  const progress = Math.min(pullDistance / threshold, 1);
  const show = pullDistance > 8 || refreshing;

  if (!show) return null;

  return (
    <div
      className="fixed top-0 left-0 right-0 z-50 flex justify-center pointer-events-none"
      style={{ transform: `translateY(${Math.min(pullDistance * 0.5, 48)}px)`, transition: refreshing ? 'none' : undefined }}
    >
      <div className="bg-card border border-border rounded-full p-2 shadow-lg">
        <Loader2
          className="w-5 h-5 text-primary"
          style={{
            animation: refreshing ? 'spin 0.8s linear infinite' : undefined,
            transform: refreshing ? undefined : `rotate(${progress * 360}deg)`,
            opacity: 0.4 + progress * 0.6,
          }}
        />
      </div>
    </div>
  );
}