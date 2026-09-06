import type { HTMLAttributes } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-[var(--radius-sm)] px-2 py-0.5 text-xs font-medium tracking-wide",
  {
    variants: {
      variant: {
        default: "bg-primary/20 text-brand",
        muted: "bg-border/60 text-muted",
        r: "bg-rtti-r/15 text-rtti-r",
        t1: "bg-rtti-t1/20 text-brand",
        t2: "bg-rtti-t2/35 text-ink",
        i: "bg-rtti-i/15 text-rtti-i",
        ok: "bg-leaf/20 text-brand",
        warn: "bg-warn/15 text-warn",
      },
    },
    defaultVariants: { variant: "default" },
  },
);

export function Badge({
  className,
  variant,
  ...props
}: HTMLAttributes<HTMLSpanElement> & VariantProps<typeof badgeVariants>) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}
