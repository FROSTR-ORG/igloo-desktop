import React from 'react';
import { cn } from "@/lib/utils";

interface PageLayoutProps {
  children: React.ReactNode;
  className?: string;
  maxWidth?: string;
}

export function PageLayout({ 
  children, 
  className, 
  maxWidth = "max-w-3xl" 
}: PageLayoutProps) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-950 to-blue-950 text-blue-100 p-8 flex flex-col items-center">
      <div className={cn("w-full", maxWidth, className)}>
        {children}
      </div>
    </div>
  );
} 