/**
 * MobileSelect — on mobile renders a bottom-sheet option picker.
 * On desktop falls back to the standard Radix Select.
 *
 * API mirrors shadcn Select:
 *   <MobileSelect value={v} onValueChange={fn} placeholder="Pick one">
 *     <MobileSelectItem value="a">Option A</MobileSelectItem>
 *     <MobileSelectItem value="b">Option B</MobileSelectItem>
 *   </MobileSelect>
 */
import { useState, Children, isValidElement } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, ChevronDown, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';

// Detect coarse pointer (touch device)
function isMobile() {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(pointer: coarse)').matches;
}

export function MobileSelectItem({ value, children, className }) {
  // Used only to carry props; rendering happens inside MobileSelect
  return null;
}

export function MobileSelect({
  value,
  onValueChange,
  placeholder = 'Seleccionar...',
  children,
  triggerClassName,
  disabled = false,
}) {
  const [open, setOpen] = useState(false);

  // Collect items from children - filter out empty/undefined values, separadores (__sep),
  // cabeceras no seleccionables (__header) y cualquier item marcado como disabled.
  // Esto evita que lascabeceras se rendericen como botones clicables y bloqueen la selección de obra (bug "pantalla blanca" en técnicos).
  const items = Children.toArray(children)
    .filter(c => isValidElement(c) && c.props.value && c.props.value !== ''
      && !c.props.value.startsWith('__sep')
      && !c.props.value.startsWith('__header')
      && !c.props.disabled)
    .map(c => ({ value: c.props.value, label: c.props.children, className: c.props.className }));

  const selectedLabel = items.find(i => i.value === value)?.label ?? placeholder;
  const hasValue = value !== undefined && value !== null && value !== '';

  if (!isMobile()) {
    if (!items.length) {
      return (
        <div className={cn(
          'flex min-h-[44px] w-full items-center justify-between whitespace-nowrap rounded-md border border-input bg-muted/50 px-3 py-2 text-sm text-muted-foreground',
          triggerClassName
        )}>
          <span>Sin opciones disponibles</span>
        </div>
      );
    }

    // Use native <select> — always works, no Radix empty-value bugs
    return (
      <div className={cn('relative w-full', triggerClassName)}>
        <select
          value={value || ''}
          onChange={e => { if (e.target.value) onValueChange(e.target.value); }}
          disabled={disabled}
          className={cn(
            'w-full appearance-none min-h-[44px] rounded-md border border-input bg-background px-3 py-2 pr-8 text-sm shadow-sm',
            'focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50',
            !value && 'text-muted-foreground'
          )}
        >
          <option value="" disabled>{placeholder}</option>
          {items.map(item => (
            <option key={item.value} value={item.value}>{item.label}</option>
          ))}
        </select>
        <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 opacity-50" />
      </div>
    );
  }

  // Mobile: bottom-sheet picker
  return (
    <>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen(true)}
        className={cn(
          'flex min-h-[44px] w-full items-center justify-between whitespace-nowrap rounded-md border border-input bg-transparent px-3 py-2.5 text-base shadow-sm',
          'focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50',
          !hasValue && 'text-muted-foreground',
          triggerClassName
        )}
      >
        <span className="truncate">{hasValue ? selectedLabel : placeholder}</span>
        <ChevronDown className="w-4 h-4 opacity-50 shrink-0 ml-2" />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            key="mobile-select-bottomsheet"
            className="fixed inset-0 z-50 flex flex-col justify-end"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            onClick={() => setOpen(false)}
          >
            <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" />

            <motion.div
              className="relative bg-card border-t border-border rounded-t-3xl shadow-2xl"
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 28, stiffness: 300 }}
              onClick={e => e.stopPropagation()}
              style={{ paddingBottom: 'env(safe-area-inset-bottom, 16px)' }}
            >
              {/* Handle */}
              <div className="w-10 h-1 bg-muted-foreground/30 rounded-full mx-auto mt-3 mb-1" />

              {/* Header */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-border">
                <p className="text-sm font-semibold">{placeholder}</p>
                <button onClick={() => setOpen(false)} className="p-1 rounded-lg hover:bg-muted transition-colors">
                  <X className="w-4 h-4 text-muted-foreground" />
                </button>
              </div>

              {/* Options */}
              <div className="overflow-y-auto max-h-[55vh] px-3 py-2">
                {items.map(item => {
                  const isSelected = item.value === value;
                  return (
                    <button
                      key={item.value}
                      type="button"
                      onClick={() => { onValueChange(item.value); setOpen(false); if (navigator?.vibrate) navigator.vibrate(8); }}
                      className={cn(
                        'w-full flex items-center justify-between px-4 py-4 rounded-xl text-base font-medium transition-all active:scale-[0.98] mb-1 min-h-[52px]',
                        isSelected
                          ? 'bg-primary text-primary-foreground'
                          : 'hover:bg-muted text-foreground',
                        item.className
                      )}
                    >
                      <span>{item.label}</span>
                      {isSelected && <Check className="w-4 h-4 shrink-0 ml-2" />}
                    </button>
                  );
                })}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}