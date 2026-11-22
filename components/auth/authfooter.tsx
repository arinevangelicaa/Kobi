import Link from "next/link";

export default function AuthFooter({ mode }: { mode: "login" | "signup" }) {
  const isLogin = mode === "login";

  return (
    <p className="mt-4 text-center text-sm">
      <Link href={isLogin ? "/signup" : "/login"} className="hover:underline">
        {isLogin ? "Don't have an account?" : "Already have an account? Log in"}
      </Link>
    </p>
  );
}
