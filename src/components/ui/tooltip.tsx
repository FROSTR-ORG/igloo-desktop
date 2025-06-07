import React, { useState, ReactNode } from 'react';
import { cn } from "@/lib/utils";

interface TooltipProps {
  trigger: ReactNode;
  content: ReactNode;
  className?: string;
  position?: 'top' | 'right' | 'bottom' | 'left';
  width?: string;
  triggerClassName?: string;
}

const Tooltip: React.FC<TooltipProps> = ({
  trigger,
  content,
  className,
  position = 'left',
  width = 'w-72',
  triggerClassName,
}) => {
  const [isVisible, setIsVisible] = useState(false);

  const positionClasses = {
    top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
    right: 'left-full top-0 ml-2',
    bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
    left: 'right-full top-0 mr-2',
  };

  return (
    <div 
      className={cn("relative inline-block", triggerClassName)}
      onMouseEnter={() => setIsVisible(true)}
      onMouseLeave={() => setIsVisible(false)}
    >
      {trigger}
      {isVisible && (
        <div 
          className={cn(
            "absolute p-3 bg-gray-800 border border-blue-900/50 rounded-md shadow-lg text-xs text-blue-200 z-50",
            positionClasses[position],
            width,
            className
          )}
        >
          {content}
        </div>
      )}
    </div>
  );
};

export { Tooltip }; 