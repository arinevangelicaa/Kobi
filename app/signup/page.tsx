import AuthHeader from "@/components/auth/authheader";
import AuthFooter from "@/components/auth/authfooter";
import GoogleButton from "@/components/auth/googlebutton";

import Button from "@/components/ui/button";
import Divider from "@/components/ui/divider";
import Input from "@/components/ui/input";

export default function SignupPage() {
  return (
    <main className="flex min-h-screen justify-center bg-bone">
      <div className="min-h-screen w-full max-w-[430px] bg-yellow shadow-xl">

        <AuthHeader />

        <section className="signup-form-section mx-auto max-w-sm px-6 py-8">

          <h2 className="signup-title relative -top-4 mb-2 text-center text-4xl font-bold text-green">
            Sign Up
          </h2>

          <form className="space-y-3">

            <Input placeholder="Username" />

            <Input type="email" placeholder="Email" />

            <Input type="password" placeholder="Password" />

            <Button>Sign Up</Button>

          </form>

          <Divider />

          <GoogleButton />

          <AuthFooter />

        </section>

      </div>
    </main>
  );
}