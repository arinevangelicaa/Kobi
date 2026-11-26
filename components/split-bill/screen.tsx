import type { ReactNode } from "react";
import Button from "@/components/ui/button";

export function SplitScreen({ title, description, action, children, onSubmit, onBack, disabled }: {
  title: string;
  description: string;
  action: string;
  children: ReactNode;
  onSubmit: (data: FormData) => void;
  onBack?: () => void;
  disabled?: boolean;
}) {
  return (
    <form className="flex min-h-[calc(100dvh-112px-env(safe-area-inset-bottom))] flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit(new FormData(event.currentTarget));
      }}>
      <header>
        {onBack && <button type="button" onClick={onBack} className="text-xs font-semibold underline">Kembali</button>}
        <h1 className="text-[28px]/[42px] font-bold text-orange">{title}</h1>
        <p className="mt-1 text-xs/4">{description}</p>
      </header>
      {children}
      <div className="mt-auto">
        <Button type="submit" disabled={disabled}
          className="rounded-2xl! text-sm font-semibold text-bone! disabled:opacity-50">
          {action}
        </Button>
      </div>
    </form>
  );
}

export const card = "space-y-2 rounded-3xl bg-white p-3 ring-1 ring-green/50 ring-inset";
export const field = "w-full min-w-0 rounded-xl border border-green/40 bg-bone px-2 py-2 text-xs";

export function Note({ children }: { children: ReactNode }) {
  return <aside className={`${card} bg-cream!`}>
    <h2 className="text-sm font-bold">Catatan</h2>
    <p className="text-[11px]/[15px] text-[#52725c]">{children}</p>
  </aside>;
}
