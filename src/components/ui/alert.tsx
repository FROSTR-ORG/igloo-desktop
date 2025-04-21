import React, { ReactNode } from 'react';
import { cn } from "@/lib/utils";
import { AlertCircle, CheckCircle, Info, XCircle } from 'lucide-react';

type AlertVariant = 'success' | 'error' | 'warning' | 'info';

interface AlertProps {
  variant: AlertVariant;
  title?: string;
  children: ReactNode;
  className?: string;
  icon?: ReactNode;
}

const variantStyles = {
  success: {
    container: "bg-green-900/30 border-green-800/30 text-green-200",
    icon: <CheckCircle className="h-4 w-4 text-green-400" />
  },
  error: {
    container: "bg-red-900/30 border-red-800/30 text-red-200",
    icon: <XCircle className="h-4 w-4 text-red-400" />
  },
  warning: {
    container: "bg-yellow-900/30 border-yellow-800/30 text-yellow-200",
    icon: <AlertCircle className="h-4 w-4 text-yellow-400" />
  },
  info: {
    container: "bg-blue-900/30 border-blue-800/30 text-blue-200",
    icon: <Info className="h-4 w-4 text-blue-400" />
  }
};

const Alert: React.FC<AlertProps> = ({
  variant = 'info',
  title,
  children,
  className,
  icon
}) => {
  return (
    <div className={cn(
      "p-3 rounded-lg border",
      variantStyles[variant].container,
      className
    )}>
      <div className="flex items-start">
        <div className="flex-shrink-0 mr-2 mt-0.5">
          {icon || variantStyles[variant].icon}
        </div>
        <div>
          {title && <div className="font-medium mb-1">{title}</div>}
          <div className="text-sm">{children}</div>
        </div>
      </div>
    </div>
  );
};

export { Alert }; 