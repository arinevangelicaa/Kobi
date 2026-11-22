import Button from "../ui/button";
import { FcGoogle } from "react-icons/fc";

export default function GoogleButton({ mode = "signup" }: { mode?: "login" | "signup" }) {
  return (
    <Button variant="outline">

      <div className="flex items-center justify-center gap-3">

        <FcGoogle size={22} aria-hidden="true" />
  
        <span>
          {mode === "login" ? "Log In with Google" : "Sign Up with Google"}
        </span>

      </div>

    </Button>
  );
}
