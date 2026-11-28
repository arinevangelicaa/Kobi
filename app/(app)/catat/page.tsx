import CatatForm from "@/components/nutrition/catat-form";

export default function CatatPage() {
  return (
    <>
      <header className="px-3 pt-[11px] pb-5">
        <h1 className="text-2xl leading-9 font-semibold text-orange">Catat</h1>
        <p className="mt-2 text-sm leading-5">
          Catat makanmu hari ini untuk mengetahui nutrisi di dalamnya
        </p>
      </header>
      <CatatForm />
    </>
  );
}
