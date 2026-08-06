import { useEffect } from "react";
import { useToast } from "@/components/ui/use-toast";
import {
  Toast,
  ToastClose,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport,
} from "@/components/ui/toast";

const DEFAULT_DURATION = 5000;

function ToastItem({ id, title, description, action, duration, dismiss, ...props }) {
  // Auto-descarte: reproduce el comportamiento estándar de Radix (5s por defecto).
  // duration=0 => sticky (no se auto-cierra).
  useEffect(() => {
    if (duration === 0) return;
    const d = duration || DEFAULT_DURATION;
    const t = setTimeout(() => dismiss(id), d);
    return () => clearTimeout(t);
  }, [id, duration, dismiss]);

  return (
    <Toast {...props}>
      <div className="grid gap-1">
        {title && <ToastTitle>{title}</ToastTitle>}
        {description && (
          <ToastDescription>{description}</ToastDescription>
        )}
      </div>
      {action}
      <ToastClose type="button" onClick={() => dismiss(id)} />
    </Toast>
  );
}

export function Toaster() {
  const { toasts, dismiss } = useToast();

  return (
    <ToastProvider>
      {toasts
        .filter((t) => t.open !== false)
        .map(function (t) {
          return <ToastItem key={t.id} {...t} dismiss={dismiss} />;
        })}
      <ToastViewport />
    </ToastProvider>
  );
}