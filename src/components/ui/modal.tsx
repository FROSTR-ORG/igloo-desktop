import React, { ReactNode, useEffect } from 'react';
import { cn } from "@/lib/utils";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  className?: string;
  showCloseButton?: boolean;
  preventClickOutside?: boolean;
  maxWidth?: string;
}

const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  children,
  className,
  showCloseButton = true,
  preventClickOutside = false,
  maxWidth = "max-w-md"
}) => {
  // Don't render anything if the modal is not open
  if (!isOpen) return null;
  
  // Handle escape key press
  useEffect(() => {
    const handleEscKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    window.addEventListener('keydown', handleEscKey);
    return () => {
      window.removeEventListener('keydown', handleEscKey);
    };
  }, [isOpen, onClose]);

  const handleOutsideClick = (event: React.MouseEvent<HTMLDivElement>) => {
    if (event.target === event.currentTarget && !preventClickOutside) {
      onClose();
    }
  };

  return (
    <div 
      className="fixed inset-0 bg-black/80 flex items-center justify-center backdrop-blur-sm z-50"
      onClick={handleOutsideClick}
    >
      <div className={cn(
        "bg-gray-900 rounded-lg shadow-xl w-full mx-4",
        maxWidth,
        className
      )}>
        {title && (
          <div className="flex justify-between items-center border-b border-gray-800 p-4">
            <h3 className="text-xl font-semibold text-blue-200">{title}</h3>
            {showCloseButton && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onClose}
                className="text-gray-400 hover:text-gray-300 hover:bg-gray-800 h-8 w-8 p-0"
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        )}
        <div className="p-4">
          {children}
        </div>
      </div>
    </div>
  );
};

export { Modal }; 