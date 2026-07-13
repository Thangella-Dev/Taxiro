import Link from "next/link";
import {
  cloneElement,
  isValidElement,
  type ButtonHTMLAttributes,
  type ReactElement,
  type ReactNode,
} from "react";

import { cn } from "@/lib/utils";

type LinkChildProps = {
  children: ReactNode;
  className?: string;
  href: string;
};

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  asChild?: boolean;
  href?: string;
  size?: "default" | "lg" | "sm";
  variant?: "default" | "outline" | "ghost" | "secondary" | "destructive";
  children: ReactNode;
};

export function Button({
  asChild,
  children,
  className,
  href,
  size = "default",
  type = "button",
  variant = "default",
  ...props
}: ButtonProps) {
  const classes = cn(
    "taxiro-button inline-flex max-w-full items-center justify-center gap-2 rounded-full text-sm font-black transition-[transform,box-shadow,background-color,border-color,color,filter] duration-300 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 active:scale-[0.96]",
    size === "lg" ? "h-12 px-5" : size === "sm" ? "h-9 px-3" : "h-11 px-4",
    variant === "default" &&
      "bg-primary text-primary-foreground shadow-[0_12px_30px_rgb(16_23_19_/_0.18)] hover:bg-primary/92 hover:shadow-[0_18px_42px_rgb(16_23_19_/_0.24)]",
    variant === "outline" &&
      "border border-border bg-card/86 shadow-[inset_0_1px_0_rgb(255_255_255_/_0.72)] hover:border-primary/25 hover:bg-muted hover:shadow-[0_12px_30px_rgb(16_23_19_/_0.09)]",
    variant === "ghost" && "hover:bg-secondary",
    variant === "secondary" &&
      "bg-secondary text-secondary-foreground hover:bg-secondary/80",
    variant === "destructive" &&
      "bg-destructive text-white hover:bg-destructive/90",
    className,
  );

  if (asChild && href) {
    return (
      <Link className={classes} href={href}>
        {children}
      </Link>
    );
  }

  if (asChild && isLinkElement(children)) {
    const childProps = children.props;
    return (
      <Link {...childProps} className={cn(childProps.className, classes)}>
        {childProps.children}
      </Link>
    );
  }

  if (asChild && isValidElement<{ className?: string }>(children)) {
    return cloneElement(children, {
      className: cn(children.props.className, classes),
    });
  }

  return (
    <button className={classes} type={type} {...props}>
      {children}
    </button>
  );
}

function isLinkElement(children: ReactNode): children is ReactElement<LinkChildProps> {
  return (
    typeof children === "object" &&
    children !== null &&
    "type" in children &&
    (children as ReactElement).type === Link
  );
}
