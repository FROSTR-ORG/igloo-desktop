import * as React from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { cva, type VariantProps } from "class-variance-authority";

const iconButtonVariants = cva(
  "inline-flex items-center justify-center p-1 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 transition-colors",
  {
    variants: {
      variant: {
        default: "bg-gray-600/50 hover:bg-gray-600/90 text-gray-100",
        ghost: "hover:bg-gray-900/30 text-gray-400 hover:text-gray-300",
        destructive: "text-red-400 hover:text-red-300 hover:bg-red-900/30",
        success: "text-green-400 hover:text-green-300 hover:bg-green-900/30",
        outline: "border border-gray-700 hover:border-gray-600 text-gray-400 hover:text-gray-300",
      },
      size: {
        default: "h-8 w-8",
        sm: "h-6 w-6",
        lg: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

export interface IconButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof iconButtonVariants> {
  icon: React.ReactNode;
  tooltip?: string;
}

const IconButton = React.forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ className, variant, size, icon, tooltip, ...props }, ref) => {
    return (
      <Button
        variant="ghost"
        size="sm"
        className={cn(iconButtonVariants({ variant, size }), className)}
        ref={ref}
        title={tooltip}
        aria-label={tooltip}
        {...props}
      >
        {icon}
      </Button>
    );
  }
);

IconButton.displayName = "IconButton";

export { IconButton, iconButtonVariants }; 