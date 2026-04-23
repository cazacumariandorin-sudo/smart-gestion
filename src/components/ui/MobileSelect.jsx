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

  // Collect items from children
  const items = Children.toArray(children)
    .filter(c => isValidElement(c))
    .map(c => ({ value: c.props.value, label: c.props.children, className: c.props.className }));

  const selectedLabel = items.find(i => i.value === value)?.label ?? placeholder;
  const hasValue = value !== undefined && value !== null && value !== '';

  if (!isMobile()) {
    // Desktop: standard Radix select
    return (
      <Select value={value} onValueChange={onValueChange} disabled={disabled}>
        <SelectTrigger className={triggerClassName}>
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {items.map(item => (
            <SelectItem key={item.value} value={item.value} className={item.className}>
              {item.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
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