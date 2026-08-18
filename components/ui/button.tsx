import type { ComponentPropsWithoutRef, ReactNode } from "react";
import { cn } from "@/lib/utils";

export type ButtonVariant = "primary" | "secondary" | "tertiary" | "ghost" | "text";
export type ButtonSize = "xl" | "lg" | "md" | "sm";

const base =
  "inline-flex items-center justify-center gap-2 rounded-md font-sans font-medium whitespace-nowrap " +
  "transition-[background-color,color,border-color,box-shadow,transform] duration-200 " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 " +
  "focus-visible:ring-offset-[var(--color-bg)] disabled:cursor-not-allowed active:translate-y-px";

const sizes: Record<ButtonSize, string> = {
  xl: "h-16 gap-4 px-7 text-[17px]",
  lg: "h-11 px-4 text-[15px]",
  md: "h-10 px-3.5 text-[14px]",
  sm: "h-8 px-3 text-[13px] rounded-sm",
};

const variants: Record<ButtonVariant, string> = {
  primary: "bg-primary-500 text-white hover:bg-primary-600 shadow-sm",
  secondary: "border border-primary-500 text-primary-500 hover:bg-primary-100",
  tertiary: "border border-line-strong bg-surface text-fg shadow-sm hover:bg-surface-2",
  ghost: "text-fg-muted hover:bg-surface-2 hover:text-fg",
  text: "px-0 text-primary-500 hover:text-primary-600",
};

const disabledVariants: Record<ButtonVariant, string> = {
  primary: "bg-primary-100 text-primary-300 shadow-none hover:bg-primary-100",
  secondary: "border-primary-200 text-primary-300 hover:bg-transparent",
  tertiary: "border-line-strong bg-surface-2 text-fg-subtle hover:bg-surface-2",
  ghost: "text-fg-subtle hover:bg-transparent",
  text: "text-primary-300 hover:text-primary-300",
};

export function buttonClasses({
  variant = "primary",
  size = "lg",
  className,
}: { variant?: ButtonVariant; size?: ButtonSize; className?: string } = {}) {
  return cn(base, sizes[size], variants[variant], className);
}

interface Shared {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: ReactNode;
  leadingIcon?: ReactNode;
  children: ReactNode;
  className?: string;
}

type ButtonProps = Shared & Omit<ComponentPropsWithoutRef<"button">, "children" | "className">;

export function Button({
  variant = "primary",
  size = "lg",
  icon,
  leadingIcon,
  disabled = false,
  className,
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      disabled={disabled}
      className={cn(
        base,
        sizes[size],
        variants[variant],
        disabled && disabledVariants[variant],
        className,
      )}
      {...props}
    >
      {leadingIcon}
      {children}
      {icon}
    </button>
  );
}
