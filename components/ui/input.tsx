import { forwardRef, InputHTMLAttributes } from "react";
import clsx from "clsx";

type InputProps = InputHTMLAttributes<HTMLInputElement>;

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, ...props }, ref) => {
    return (
      <input
        ref={ref}
        className={clsx(
          "w-full h-13 px-5",
          "rounded-[20px]",
          "border border-gray-300",
          "bg-bone",
          "text-green",
          "placeholder:text-green/60",
          "outline-none",
          "transition-all",
          "focus:border-green",
          "focus:ring-2 focus:ring-green/20",
          className
        )}
        {...props}
      />
    );
  }
);

Input.displayName = "Input";

export default Input;