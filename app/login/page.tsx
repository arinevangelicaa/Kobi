import AuthHeader from "@/components/auth/authheader";
import AuthFooter from "@/components/auth/authfooter";
import GoogleButton from "@/components/auth/googlebutton";

import Button from "@/components/ui/button";
import Divider from "@/components/ui/divider";
import Input from "@/components/ui/input";

export default function LoginPage() {
  return (
    <main className="min-h-screen bg-yellow">
      <AuthHeader />

      <section className="mx-auto max-w-sm px-6 py-8">
        <h2 className="relative -top-4 mb-2 text-center text-4xl font-bold text-green">
          Login
        </h2>

        <form className="space-y-3">
          <Input
            type="text"
            placeholder="Username"
            autoComplete="username"
          />

          <Input
            type="password"
            placeholder="Password"
            autoComplete="current-password"
          />

          <div className="flex justify-end">
            <button
              type="button"
              className="text-sm text-green hover:underline"
            >
              forgot password?
            </button>
          </div>

          <Button type="submit">
            Login
          </Button>
        </form>

        <Divider />

        <GoogleButton mode="login" />

        <AuthFooter mode="login" />
      </section>
    </main>
  );
}