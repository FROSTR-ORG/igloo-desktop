import React, { useState, ReactNode, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { cn } from "@/lib/utils";

interface TooltipProps {
  trigger: ReactNode;
  content: ReactNode;
  className?: string;
  position?: 'top' | 'right' | 'bottom' | 'left';
  width?: string;
  triggerClassName?: string;
  focusable?: boolean;
}

const Tooltip: React.FC<TooltipProps> = ({
  trigger,
  content,
  className,
  position = 'left',
  width = 'w-72',
  triggerClassName,
  focusable = false,
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const [coords, setCoords] = useState<{ top: number; left: number }>({ top: 0, left: 0 });
  const triggerRef = useRef<HTMLDivElement | null>(null);
  const tooltipRef = useRef<HTMLDivElement | null>(null);

  const updatePosition = useCallback(() => {
    if (typeof window === 'undefined' || !triggerRef.current || !tooltipRef.current) {
      return;
    }

    const triggerRect = triggerRef.current.getBoundingClientRect();
    const tooltipRect = tooltipRef.current.getBoundingClientRect();

    let top = triggerRect.top;
    let left = triggerRect.left;

    switch (position) {
      case 'top':
        top = triggerRect.top - tooltipRect.height - 8;
        left = triggerRect.left + (triggerRect.width / 2) - (tooltipRect.width / 2);
        break;
      case 'right':
        top = triggerRect.top + (triggerRect.height / 2) - (tooltipRect.height / 2);
        left = triggerRect.right + 8;
        break;
      case 'bottom':
        top = triggerRect.bottom + 8;
        left = triggerRect.left + (triggerRect.width / 2) - (tooltipRect.width / 2);
        break;
      case 'left':
      default:
        top = triggerRect.top + (triggerRect.height / 2) - (tooltipRect.height / 2);
        left = triggerRect.left - tooltipRect.width - 8;
        break;
    }

    const clampedTop = Math.max(8, top);
    const clampedLeft = Math.max(8, Math.min(left, window.innerWidth - tooltipRect.width - 8));

    setCoords({ top: clampedTop, left: clampedLeft });
  }, [position]);

  useEffect(() => {
    if (!isVisible || typeof window === 'undefined') {
      return;
    }

    let frame: number | null = window.requestAnimationFrame(() => updatePosition());

    window.addEventListener('scroll', updatePosition, true);
    window.addEventListener('resize', updatePosition);

    return () => {
      if (frame !== null) {
        window.cancelAnimationFrame(frame);
      }
      frame = null;
      window.removeEventListener('scroll', updatePosition, true);
      window.removeEventListener('resize', updatePosition);
    };
  }, [isVisible, updatePosition]);

  const tooltipNode = (
    <div
      ref={tooltipRef}
      className={cn(
        'fixed p-3 bg-gray-800 border border-blue-900/50 rounded-md shadow-lg text-xs text-blue-200 z-[9999]',
        width,
        className
      )}
      style={{ top: coords.top, left: coords.left, pointerEvents: 'none' }}
    >
      {content}
    </div>
  );

  return (
    <div
      ref={triggerRef}
      className={cn('inline-flex align-middle', triggerClassName)}
      onMouseEnter={() => setIsVisible(true)}
      onMouseLeave={() => setIsVisible(false)}
      onFocus={focusable ? () => setIsVisible(true) : undefined}
      onBlur={focusable ? () => setIsVisible(false) : undefined}
      tabIndex={focusable ? 0 : undefined}
      role={focusable ? 'button' : undefined}
    >
      {trigger}
      {isVisible && typeof document !== 'undefined' ? createPortal(tooltipNode, document.body) : null}
    </div>
  );
};

export { Tooltip }; 
