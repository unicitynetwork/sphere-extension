import { useEffect, useRef } from 'react';
import type { ReactNode } from 'react';

type ModalSize = 'sm' | 'md' | 'lg';

interface BaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  children: ReactNode;
  /** Modal max-width: sm (384px), md (448px), lg (512px) */
  size?: ModalSize;
  /** Show decorative background orbs */
  showOrbs?: boolean;
  /** Additional className for the modal container */
  className?: string;
}

const sizeClasses: Record<ModalSize, string> = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
};

export function BaseModal({
  isOpen,
  onClose,
  children,
  size = 'md',
  showOrbs = true,
  className = '',
}: BaseModalProps) {
  const backdropRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  // Handle enter/exit transitions via CSS classes
  useEffect(() => {
    if (isOpen) {
      // Trigger enter transition on next frame so the initial state is rendered first
      requestAnimationFrame(() => {
        backdropRef.current?.classList.add('opacity-100');
        backdropRef.current?.classList.remove('opacity-0');
        panelRef.current?.classList.add('opacity-100', 'scale-100', 'translate-y-0');
        panelRef.current?.classList.remove('opacity-0', 'scale-95', 'translate-y-4');
      });
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        ref={backdropRef}
        onClick={onClose}
        className="fixed inset-0 z-100 bg-black/60 dark:bg-black/80 backdrop-blur-sm opacity-0 transition-opacity duration-200"
      />

      {/* Modal Container */}
      <div className="fixed inset-0 z-100 flex items-center justify-center p-4 sm:p-6 pointer-events-none">
        <div
          ref={panelRef}
          onClick={(e) => e.stopPropagation()}
          className={`relative w-full ${sizeClasses[size]} max-h-[70dvh] sm:max-h-[600px] bg-white dark:bg-[#111] border border-neutral-200 dark:border-white/10 rounded-3xl shadow-2xl pointer-events-auto flex flex-col overflow-hidden opacity-0 scale-95 translate-y-4 transition-all duration-300 ease-out ${className}`}
        >
          {/* Background Orbs */}
          {showOrbs && (
            <>
              <div className="absolute top-0 right-0 w-48 h-48 bg-orange-500/10 rounded-full blur-3xl pointer-events-none" />
              <div className="absolute bottom-0 left-0 w-48 h-48 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />
            </>
          )}

          {children}
        </div>
      </div>
    </>
  );
}
