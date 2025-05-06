import React, { useState, ReactNode } from 'react';
import { cn } from "@/lib/utils";
import { ChevronDown, ChevronUp } from "lucide-react";

interface CollapsibleProps {
  title: ReactNode;
  children: ReactNode;
  className?: string;
  contentClassName?: string;
  titleClassName?: string;
  defaultOpen?: boolean;
  icon?: ReactNode;
  actions?: ReactNode;
}

const Collapsible: React.FC<CollapsibleProps> = ({
  title,
  children,
  className,
  contentClassName,
  titleClassName,
  defaultOpen = false,
  icon,
  actions
}) => {
  const [isExpanded, setIsExpanded] = useState(defaultOpen);

  const toggleExpanded = () => {
    setIsExpanded(prev => !prev);
  };

  return (
    <div className={cn("space-y-2", className)}>
      <div 
        className={cn(
          "flex items-center justify-between p-2.5 rounded cursor-pointer hover:bg-gray-800/70 transition-colors",
          titleClassName || "bg-gray-800/50"
        )}
        onClick={toggleExpanded}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            toggleExpanded();
          }
        }}
      >
        <div className="flex items-center gap-2">
          {icon || (isExpanded ? 
            <ChevronUp className="h-4 w-4 text-blue-400" /> : 
            <ChevronDown className="h-4 w-4 text-blue-400" />
          )}
          <span className="text-blue-200 text-sm font-medium select-none">{title}</span>
        </div>
        {actions && (
          <div onClick={e => e.stopPropagation()}>
            {actions}
          </div>
        )}
      </div>
      <div 
        className={cn(
          "transition-all duration-300 ease-in-out overflow-hidden",
          isExpanded ? "max-h-[500px] opacity-100" : "max-h-0 opacity-0",
          contentClassName
        )}
      >
        {children}
      </div>
    </div>
  );
};

export { Collapsible }; 