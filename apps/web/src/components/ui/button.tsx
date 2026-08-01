import Link from "next/link";
import type { ButtonHTMLAttributes, ReactNode } from "react";

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
type ButtonSize = "sm" | "md";

interface CommonProps {
  children: ReactNode;
  className?: string;
  icon?: ReactNode;
  variant?: ButtonVariant;
  size?: ButtonSize;
}

type ButtonProps = CommonProps &
  ButtonHTMLAttributes<HTMLButtonElement> & { href?: never };

type LinkButtonProps = CommonProps & {
  href: string;
  "aria-label"?: string;
};

function classes({
  variant = "primary",
  size = "md",
  className = "",
}: Pick<CommonProps, "variant" | "size" | "className">) {
  return `button button--${variant} button--${size} ${className}`.trim();
}

export function Button(props: ButtonProps | LinkButtonProps) {
  if ("href" in props && props.href) {
    const { children, className, href, icon, size, variant, ...rest } = props;
    return (
      <Link
        href={href}
        className={classes({ className, size, variant })}
        {...rest}
      >
        {icon}
        <span>{children}</span>
      </Link>
    );
  }

  const { children, className, icon, size, variant, ...rest } =
    props as ButtonProps;
  return (
    <button className={classes({ className, size, variant })} {...rest}>
      {icon}
      <span>{children}</span>
    </button>
  );
}
