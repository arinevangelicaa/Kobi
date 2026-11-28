import clsx from "clsx";
import Link from "next/link";

import AuthHeader from "@/components/auth/authheader";
import PasswordRecoveryForm from "@/components/auth/password-recovery-form";

export default function PasswordRecoveryScreen({
  mode,
}: {
  mode: "forgot" | "reset";
}) {
  const reset = mode === "reset";

  return (
    <main className="flex-1 bg-yellow">
      <AuthHeader />

      <section
        lang="en"
        aria-labelledby="recovery-title"
        className={clsx("mx-auto w-full max-w-[354px] px-6 pb-4", reset ? "pt-1" : "pt-[18px]")}
      >
        <div className="text-center">
          <h2 id="recovery-title" className="text-2xl leading-9 font-bold">
            {reset ? "Reset password" : "Forgot password?"}
          </h2>
          <p className="mt-2 text-xs leading-[18px]">
            {reset ? "Create a new password to keep your KOBI account secure." : (
              <>
                Enter your registered email address.
                <br />
                We’ll send you a link to reset your password.
              </>
            )}
          </p>
        </div>

        <PasswordRecoveryForm mode={mode} />

        <Link
          href="/login"
          className={clsx(
            "flex items-center justify-center rounded-lg text-sm font-semibold hover:underline focus-visible:outline-2 focus-visible:outline-offset-2",
            reset ? "mt-2.5 min-h-8" : "mt-5 min-h-11",
          )}
        >
          Back to login
        </Link>
      </section>
    </main>
  );
}
