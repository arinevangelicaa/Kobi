import AuthHeader from "@/components/auth/authheader";
import AuthFooter from "@/components/auth/authfooter";
import CredentialsForm from "@/components/auth/credentials-form";
import GoogleButton from "@/components/auth/googlebutton";

import Divider from "@/components/ui/divider";
import Input from "@/components/ui/input";

export default function SignupPage() {
  return (
    <main className="flex-1 bg-yellow">
      <AuthHeader />

      <section className="signup-form-section mx-auto max-w-sm px-6 py-8">
        <h2 className="signup-title relative -top-4 mb-2 text-center text-4xl font-bold text-green">
          Sign Up
        </h2>

        <CredentialsForm mode="signup">
          <Input name="nama" aria-label="Nama" placeholder="Nama" autoComplete="name" maxLength={100} required />
          <Input type="email" name="email" aria-label="Email" placeholder="Email" autoComplete="email" required />
          <Input type="password" name="password" aria-label="Password" placeholder="Password" autoComplete="new-password" minLength={8} required />
        </CredentialsForm>

        <Divider />
        <GoogleButton />
        <AuthFooter mode="signup" />
      </section>
    </main>
  );
}
