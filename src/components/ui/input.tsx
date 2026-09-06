import * as React from "react";
import { cn } from "@/lib/utils";

export const fieldClassName =
  "flex h-12 w-full rounded-[var(--radius-md)] border border-transparent bg-paper px-4 text-base text-fg transition-[box-shadow,border-color] duration-[var(--motion-quick)] ease-[var(--ease-out)] placeholder:text-muted/70 focus-visible:border-brand/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 disabled:opacity-50 md:text-sm";

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, ...props }, ref) => (
    <input
      type={type}
      className={cn(fieldClassName, className)}
      ref={ref}
      {...props}
    />
  ),
);
Input.displayName = "Input";

export { Input };
