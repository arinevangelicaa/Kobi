import AuthHeader from "@/components/auth/authheader";
import AuthFooter from "@/components/auth/authfooter";
import CredentialsForm from "@/components/auth/credentials-form";
import GoogleButton from "@/components/auth/googlebutton";

import Divider from "@/components/ui/divider";
import Input from "@/components/ui/input";

export default function LoginPage() {
  return (
    <main className="flex-1 bg-yellow">
      <AuthHeader />

      <section className="mx-auto max-w-sm px-6 py-8">
        <h2 className="relative -top-4 mb-2 text-center text-4xl font-bold text-green">
          Login
        </h2>

        <CredentialsForm mode="login">
          <Input
            type="email"
            name="email"
            aria-label="Email"
            placeholder="Email"
            autoComplete="username"
            required
          />

          <Input
            type="password"
            name="password"
            aria-label="Password"
            placeholder="Password"
            autoComplete="current-password"
            required
          />

          <div className="flex justify-end">
            <button
              type="button"
              className="text-sm text-green hover:underline"
            >
              forgot password?
            </button>
          </div>

        </CredentialsForm>

        <Divider />

        <GoogleButton mode="login" />

        <AuthFooter mode="login" />
      </section>
    </main>
  );
}
