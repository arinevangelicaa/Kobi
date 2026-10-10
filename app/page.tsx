export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-green px-6 text-cream">
      <h1 className="text-5xl font-bold">KOBI</h1>
      <p className="text-xs font-medium">Asisten Gizi Mahasiswa</p>

      <div className="mt-6 flex w-full max-w-xs flex-col gap-3 rounded-2xl bg-yellow p-6 text-green">
        <h2 className="text-2xl font-bold">Login</h2>
        <p className="text-sm font-normal">Tes font regular 14px</p>
        <p className="text-xs font-semibold">Tes semibold 12px</p>
        <p className="text-xxs font-normal">Tes teks kecil 10px</p>
        <button className="rounded-lg bg-green py-2 text-sm font-semibold text-bone">
          Tombol
        </button>
        <span className="text-xs font-medium text-orange">Teks oranye</span>
      </div>
    </main>
  );
}