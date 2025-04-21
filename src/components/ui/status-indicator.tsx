import React from 'react';
import { cn } from "@/lib/utils";

interface StatusIndicatorProps {
  status: 'success' | 'error' | 'warning' | 'info' | 'idle';
  label?: string;
  count?: number;
  className?: string;
  dotClassName?: string;
  labelClassName?: string;
}

const StatusIndicator: React.FC<StatusIndicatorProps> = ({
  status,
  label,
  count,
  className,
  dotClassName,
  labelClassName,
}) => {
  const statusColors = {
    success: 'bg-green-500',
    error: 'bg-red-500',
    warning: 'bg-yellow-500',
    info: 'bg-blue-500',
    idle: 'bg-gray-500',
  };

  return (
    <div className={cn("flex items-center gap-1.5 bg-gray-900/70 px-2 py-0.5 rounded text-xs", className)}>
      <div className={cn("w-2 h-2 rounded-full", statusColors[status], dotClassName)} />
      {(label || count !== undefined) && (
        <span className={cn("text-gray-400", labelClassName)}>
          {label}
          {count !== undefined && (count === 0 ? 'No' : count)} 
          {count !== undefined && ' ' + (count === 1 ? 'event' : 'events')}
        </span>
      )}
    </div>
  );
};

export { StatusIndicator }; 