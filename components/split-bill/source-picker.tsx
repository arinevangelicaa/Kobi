import { SplitScreen } from "./screen";

const sources = [
  {
    value: "struk",
    label: "Unggah struk",
    description: "Foto struk langsung atau dari galeri.",
  },
  {
    value: "manual",
    label: "Catat manual",
    description: "Tulis pesanan dan harga secara manual.",
  },
];

const steps = [
  { label: "Unggah struk atau catat manual.", color: "bg-yellow" },
  {
    label: "Tambah peserta dan tentukan pesanan masing-masing.",
    color: "bg-green-light",
  },
  { label: "Lihat total tagihan tiap peserta.", color: "bg-cream" },
];

type Source = "struk" | "manual";

export default function SourcePicker({ source, feedback, onSelect, onContinue }: {
  source: Source;
  feedback: string;
  onSelect: (source: Source) => void;
  onContinue: (source: Source) => void;
}) {
  return (
    <SplitScreen title="Split Bill" description="Unggah struk atau catat manual untuk membagi tagihan."
      action="Lanjutkan" onSubmit={() => onContinue(source)}>
      {feedback && <p role="status" className="text-xs">{feedback}</p>}

      <section className="rounded-3xl bg-green-light p-3 ring-1 ring-green/50 ring-inset">
        <h2 id="split-bill-source" className="text-base/6 font-semibold">
          1. Pilih sumber tagihan
        </h2>
        <fieldset aria-labelledby="split-bill-source" className="mt-2 grid min-w-0 grid-cols-2 gap-3">
          {sources.map(({ value, label, description }) => (
            <label key={value} className="relative block min-w-0 cursor-pointer">
              <input
                type="radio"
                name="sumber-tagihan"
                value={value}
                checked={value === source}
                onChange={() => onSelect(value === "struk" ? "struk" : "manual")}
                className="peer sr-only"
              />
              <span className="flex h-full flex-col gap-1.5 rounded-[20px] bg-cream p-3 peer-checked:bg-green peer-checked:text-bone peer-checked:[&_small]:text-cream peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-green">
                <span className="text-sm/5 font-semibold">{label}</span>
                <small className="text-[11px]/[15px] text-[#52725c]">
                  {description}
                </small>
              </span>
            </label>
          ))}
        </fieldset>
      </section>

      <section className="rounded-3xl bg-white p-3 ring-1 ring-green/50 ring-inset">
        <h2 className="text-sm/5 font-bold">Alur split bill</h2>
        <ol className="mt-2 space-y-2" role="list">
          {steps.map(({ label, color }, index) => (
            <li key={label} className="flex items-center gap-2.5 text-xs/4">
              <span aria-hidden="true" className={`grid size-6 shrink-0 place-items-center rounded-full text-xxs ${color}`}>
                {index + 1}
              </span>
              {label}
            </li>
          ))}
        </ol>
      </section>

    </SplitScreen>
  );
}
