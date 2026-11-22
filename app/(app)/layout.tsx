import type { ReactNode } from "react";

import BottomNavigation from "@/components/app/bottom-navigation";

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <main className="flex-1 px-6 pt-8 pb-[calc(5rem+env(safe-area-inset-bottom))]">
        {children}
      </main>
      <BottomNavigation />
    </>
  );
}
