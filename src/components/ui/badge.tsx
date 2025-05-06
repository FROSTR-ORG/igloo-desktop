import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-md px-1.5 py-0.5 text-xs font-medium ring-1 ring-inset",
  {
    variants: {
      variant: {
        default: "bg-gray-500/20 text-gray-400 ring-gray-500/30",
        error: "bg-red-500/20 text-red-400 ring-red-500/30",
        success: "bg-green-500/20 text-green-400 ring-green-500/30",
        warning: "bg-yellow-500/20 text-yellow-400 ring-yellow-500/30",
        info: "bg-blue-500/20 text-blue-400 ring-blue-500/30",
        purple: "bg-purple-500/20 text-purple-400 ring-purple-500/30",
        orange: "bg-orange-500/20 text-orange-400 ring-orange-500/30",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants }; 