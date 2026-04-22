/**
 * PageHeader — consistent sticky top bar across all pages.
 * Provides a native-feel header with back button, title, subtitle and right-side actions.
 */
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function PageHeader({ title, subtitle, onBack, backTo, actions, className }) {
  const navigate = useNavigate();

  const handleBack = () => {
    if (onBack) return onBack();
    if (backTo) return navigate(backTo);
    navigate(-1);
  };

  return (
    <div className={cn(
      'sticky top-0 z-30 bg-background/90 backdrop-blur-md border-b border-border',
      className
    )}
    style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}
    >
      <div className="flex items-center gap-1 px-3 h-14 max-w-3xl mx-auto lg:max-w-5xl">
        <Button
          variant="ghost"
          size="icon"
          onClick={handleBack}
          className="shrink-0 h-10 w-10 rounded-full"
        >
          <ArrowLeft className="w-5 h-5" />
        </Button>

        <div className="flex-1 min-w-0 ml-1">
          <h1 className="text-base font-bold leading-tight truncate">{title}</h1>
          {subtitle && <p className="text-xs text-muted-foreground truncate">{subtitle}</p>}
        </div>

        {actions && (
          <div className="flex items-center gap-1.5 shrink-0 ml-2">
            {actions}
          </div>
        )}
      </div>
    </div>
  );
}