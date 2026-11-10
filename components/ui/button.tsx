import { ButtonHTMLAttributes } from "react";
import clsx from "clsx";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "outline";
}

export default function Button({
  children,
  className,
  variant = "primary",
  ...props
}: ButtonProps) {
  return (
    <button
      className={clsx(
        "w-full h-12 rounded-[20px]",
        "transition-all",
        "active:scale-95",

        variant === "primary" &&
          "bg-green text-cream hover:bg-[#0E3820]",

        variant === "outline" &&
          "border border-gray-300 bg-bone text-green hover:bg-[#F4E6C3]",

        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}