import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Copy, Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface CopyButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  value: string;
  onCopy?: () => void;
  variant?: "ghost" | "default" | "destructive" | "outline" | "secondary" | "link";
  size?: "default" | "sm" | "lg" | "icon";
  iconOnly?: boolean;
}

const CopyButton = React.forwardRef<HTMLButtonElement, CopyButtonProps>(
  ({ className, value, onCopy, variant = "ghost", size = "sm", iconOnly = false, children, ...props }, ref) => {
    const [copied, setCopied] = useState(false);

    const handleCopy = async () => {
      try {
        await navigator.clipboard.writeText(value);
        setCopied(true);
        
        // Call the optional onCopy callback
        if (onCopy) onCopy();
        
        // Reset copied state after 2 seconds
        setTimeout(() => {
          setCopied(false);
        }, 2000);
      } catch (err) {
        console.error("Failed to copy text:", err);
      }
    };

    return (
      <Button
        ref={ref}
        variant={variant}
        size={size}
        onClick={handleCopy}
        className={cn(
          "text-blue-400 hover:text-blue-300 hover:bg-blue-900/30 transition-colors duration-300",
          copied && "text-green-400 hover:text-green-300",
          className
        )}
        {...props}
      >
        <span className="relative inline-flex items-center justify-center w-4 h-4">
          <span className={cn(
            "absolute inset-0 transition-all duration-200 transform",
            copied ? "opacity-0 scale-50 rotate-90" : "opacity-100 scale-100 rotate-0"
          )}>
            <Copy className="h-4 w-4" />
          </span>
          <span className={cn(
            "absolute inset-0 transition-all duration-200 transform",
            copied ? "opacity-100 scale-100 rotate-0" : "opacity-0 scale-50 rotate-90"
          )}>
            <Check className="h-4 w-4" />
          </span>
        </span>
        {!iconOnly && (
          <span className="ml-1 transition-all duration-200">
            {children || (copied ? "Copied!" : "Copy")}
          </span>
        )}
      </Button>
    );
  }
);

CopyButton.displayName = "CopyButton";

export { CopyButton }; 