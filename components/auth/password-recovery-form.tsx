"use client";

import clsx from "clsx";
import { EyeOff } from "lucide-react";
import Image from "next/image";
import { useState, type FormEvent } from "react";

import Button from "@/components/ui/button";
import Input from "@/components/ui/input";

const minimumPasswordLength = 8;

function PasswordField({
  name,
  label,
  placeholder,
}: {
  name: string;
  label: string;
  placeholder: string;
}) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="flex flex-col gap-[9px]">
      <label htmlFor={name} className="text-sm leading-[21px] font-semibold">{label}</label>
      <div className="relative">
        <Input
          id={name}
          name={name}
          type={visible ? "text" : "password"}
          placeholder={placeholder}
          autoComplete="new-password"
          aria-describedby="password-requirements"
          minLength={minimumPasswordLength}
          className="rounded-xl! border-[#e7dabb]! pr-[52px]! pl-4! text-xs placeholder:text-[#617569]!"
          required
        />
        <button
          type="button"
          aria-label={`${visible ? "Hide" : "Show"} ${label.toLowerCase()}`}
          aria-controls={name}
          onClick={() => setVisible(!visible)}
          className="absolute inset-y-1 right-1.5 inline-flex w-10 items-center justify-center rounded-lg text-green hover:bg-green/5 focus-visible:outline-2"
        >
          {visible ? (
            <EyeOff size={22} aria-hidden />
          ) : (
            <Image src="/assets/password-recovery/eye.svg" alt="" width={22} height={22} unoptimized />
          )}
        </button>
      </div>
    </div>
  );
}

export default function PasswordRecoveryForm({ mode }: { mode: "forgot" | "reset" }) {
  const reset = mode === "reset";
  const [message, setMessage] = useState("");

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (reset) {
      const data = new FormData(event.currentTarget);
      const password = String(data.get("password") ?? "");

      if (!/\p{L}/u.test(password) || !/\p{N}/u.test(password)) {
        setMessage("Use both letters and numbers in your new password.");
        return;
      }

      if (password !== data.get("confirm-password")) {
        setMessage("The passwords do not match.");
        return;
      }
    }

    setMessage("Password recovery is currently unavailable.");
  }

  return (
    <form
      method="post"
      onSubmit={handleSubmit}
      onChange={() => setMessage("")}
      className={clsx("flex flex-col", reset ? "mt-2.5 gap-2.5" : "mt-5 gap-5")}
    >
      {reset ? (
        <>
          <div className="mb-0.5 flex flex-col gap-5">
            <PasswordField name="password" label="New password" placeholder="Enter new password" />
            <PasswordField name="confirm-password" label="Confirm password" placeholder="Re-enter new password" />
          </div>
          <p
            id="password-requirements"
            className="flex min-h-[42px] items-center gap-2 rounded-[10px] bg-[#f8db83] px-[11px] py-2 text-[11px]"
          >
            <Image src="/assets/password-recovery/info.svg" alt="" width={18} height={18} unoptimized className="shrink-0" />
            At least {minimumPasswordLength} characters with letters and numbers.
          </p>
        </>
      ) : (
        <div className="flex flex-col gap-2">
          <label htmlFor="recovery-email" className="text-sm leading-[21px] font-semibold">Email address</label>
          <Input
            id="recovery-email"
            name="email"
            type="email"
            autoComplete="email"
            placeholder="Enter your email"
            className="border-[#d9d9d9]! text-sm placeholder:text-green!"
            required
          />
        </div>
      )}

      <Button
        type="submit"
        className={clsx("text-sm text-bone! focus-visible:outline-2 focus-visible:outline-offset-2", reset && "rounded-[13px]! font-semibold")}
      >
        {reset ? "Reset password" : "Send reset link"}
      </Button>
      {message && <p role="alert" className="text-sm font-medium">{message}</p>}
    </form>
  );
}
