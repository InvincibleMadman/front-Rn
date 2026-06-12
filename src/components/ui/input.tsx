import * as React from "react";
import { cn } from "@/lib/utils/cn";

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, ...props }, ref) => {
    const isFile = type === "file";
    return (
      <input
        type={type}
        className={cn(
          "w-full rounded-[var(--radius-lg)] border border-input text-sm text-foreground shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60",
          isFile
            ? "h-11 bg-background/60 px-3 py-1 file:mr-3 file:h-8 file:rounded-[var(--radius-md)] file:border-0 file:bg-primary/12 file:px-3 file:text-sm file:font-medium file:leading-none file:text-primary hover:file:bg-primary/18"
            : "flex h-10 bg-background/60 px-3 py-2",
          className,
        )}
        ref={ref}
        {...props}
      />
    );
  },
);

Input.displayName = "Input";

export { Input };
