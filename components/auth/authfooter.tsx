import Link from "next/link";

export default function AuthFooter() {
  return (
    <p className="mt-4 text-center text-sm">

      <Link
        href="/login"
        className="hover:underline"
      >
        Have an account?
      </Link>

    </p>
  );
}