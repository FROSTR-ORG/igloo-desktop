import React from 'react';
import { cn } from "@/lib/utils";
import { IconButton } from "@/components/ui/icon-button";
import { ArrowLeft } from 'lucide-react';

interface ContentCardProps {
  children: React.ReactNode;
  title?: string;
  onBack?: () => void;
  backButtonTooltip?: string;
  className?: string;
  headerRight?: React.ReactNode;
}

export function ContentCard({ 
  children, 
  title, 
  onBack, 
  backButtonTooltip = "Back",
  className,
  headerRight
}: ContentCardProps) {
  return (
    <div className={cn("bg-gray-900/40 rounded-lg p-6 shadow-lg", className)}>
      {(title || onBack || headerRight) && (
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-2">
            {title && <h2 className="text-xl font-semibold text-blue-300">{title}</h2>}
          </div>
          
          <div className="flex items-center gap-2">
            {headerRight}
            {onBack && (
              <IconButton
                variant="ghost"
                icon={<ArrowLeft className="w-4 h-4" />}
                onClick={onBack}
                tooltip={backButtonTooltip}
                className="text-blue-400 hover:text-blue-300 hover:bg-blue-900/30"
              />
            )}
          </div>
        </div>
      )}
      
      {children}
    </div>
  );
} 