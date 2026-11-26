import SplitBillFlow from "@/components/split-bill/flow";
import { auth } from "@/lib/auth";

export const metadata = { title: "Split Bill | Kobi" };

export default async function SplitBillPage() {
  const session = await auth();
  return <SplitBillFlow userId={session?.user?.id} />;
}
