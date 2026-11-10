import Button from "../ui/button";
import { FcGoogle } from "react-icons/fc";

export default function GoogleButton() {
  return (
    <Button variant="outline">

      <div className="flex items-center justify-center gap-3">

        <FcGoogle size={22} aria-hidden="true" />
  
        <span>
          Sign Up with Google
        </span>

      </div>

    </Button>
  );
}