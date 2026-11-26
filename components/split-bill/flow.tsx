"use client";

import Link from "next/link";
import { useEffect, useSyncExternalStore } from "react";
import { historyKey, rupiah, type HistoryEntry } from "./history-data";
import { card, field, Note, SplitScreen } from "./screen";
import SourcePicker from "./source-picker";

type Step = "source" | "upload" | "review" | "manual" | "people" | "result";
type Item = { id: string; name: string; quantity: number; price: number | ""; owner: string };
const blankItem: Item = { id: "initial", name: "", quantity: 1, price: "", owner: "all" };
const exampleItems: Item[] = [
  { id: "nasi", name: "Nasi ayam geprek", quantity: 2, price: 18000, owner: "all" },
  { id: "teh", name: "Es teh manis", quantity: 3, price: 4000, owner: "all" },
  { id: "sate", name: "Sate ayam", quantity: 1, price: 12000, owner: "all" },
];

type Draft = {
  step: Step;
  source: "struk" | "manual";
  selectedSource: "struk" | "manual";
  photoMode: "camera" | "gallery";
  photoUrl: string;
  items: Item[];
  people: { id: string; name: string }[];
  title: string;
  rate: number;
  feedback: string;
  confirmSent: boolean;
};

const emptyDraft: Draft = {
  step: "source", source: "manual", selectedSource: "manual", photoMode: "gallery", photoUrl: "",
  items: [blankItem], people: [{ id: "you", name: "Kamu" }],
  title: "", rate: 10, feedback: "", confirmSent: false,
};
const drafts = new Map<string, Draft>();
const draftListeners = new Set<() => void>();

function subscribeToDraft(listener: () => void) {
  draftListeners.add(listener);
  return () => { draftListeners.delete(listener); };
}

function addProportionalTax<T extends { amount: number }>(portions: T[], subtotal: number, tax: number) {
  let allocated = 0;
  return portions.map((person) => {
    const previousTax = subtotal ? Math.round(allocated * tax / subtotal) : 0;
    allocated += person.amount;
    const personTax = subtotal ? Math.round(allocated * tax / subtotal) - previousTax : 0;
    return { ...person, tax: personTax, total: person.amount + personTax };
  });
}

function BillTotal({ subtotal, tax, rate }: { subtotal: number; tax: number; rate: number }) {
  return <dl className="space-y-1 text-xs">
    <div className="flex justify-between gap-2"><dt>Subtotal pesanan</dt><dd>{rupiah(subtotal)}</dd></div>
    <div className="flex justify-between gap-2"><dt>Pajak {rate}%</dt><dd>{rupiah(tax)}</dd></div>
    <div className="flex justify-between gap-2 border-t border-green/30 pt-1 text-sm font-bold">
      <dt>Total tagihan</dt><dd>{rupiah(subtotal + tax)}</dd>
    </div>
  </dl>;
}

export default function SplitBillFlow({ userId }: { userId?: string }) {
  const draftKey = userId ?? "";
  const readDraft = () => drafts.get(draftKey) ?? emptyDraft;
  const draft = useSyncExternalStore(subscribeToDraft, readDraft, () => emptyDraft);
  const { step, source, photoMode, photoUrl, items, people, title, rate, feedback, confirmSent } = draft;

  function updateDraft(changes: Partial<Draft>) {
    const previous = readDraft();
    const next = { ...previous, ...changes };
    if (previous.photoUrl && previous.photoUrl !== next.photoUrl) URL.revokeObjectURL(previous.photoUrl);
    drafts.set(draftKey, next);
    draftListeners.forEach((listener) => listener());
  }

  function setStep(step: Step) {
    updateDraft({ step });
  }

  useEffect(() => { window.scrollTo(0, 0); }, [step]);

  const subtotal = items.reduce((sum, item) => sum + Number(item.price) * item.quantity, 0);
  const tax = Math.round(subtotal * rate / 100);
  const portions = people.map((person, index) => {
    const amount = items.reduce((sum, item) => {
      const value = Number(item.price) * item.quantity;
      if (item.owner === person.id) return sum + value;
      if (item.owner !== "all") return sum;
      return sum + Math.floor(value / people.length) + Number(index < value % people.length);
    }, 0);
    return { ...person, amount };
  });
  const shares = addProportionalTax(portions, subtotal, tax);

  function editItem(id: string, changes: Partial<Item>) {
    updateDraft({ items: readDraft().items.map((item) => item.id === id ? { ...item, ...changes } : item) });
  }

  function openResult() {
    updateDraft({ feedback: "", confirmSent: false, step: "result" });
  }

  function saveSharedBill() {
    if (!userId) return false;

    const entry: HistoryEntry = {
      id: crypto.randomUUID(), title: title.trim() || "Split Bill",
      date: new Intl.DateTimeFormat("id-ID", {
        dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Jakarta",
      }).format(new Date()),
      people: people.length, total: subtotal + tax, share: shares[0].total, tax: shares[0].tax,
    };
    try {
      const key = historyKey(userId);
      const entries = JSON.parse(localStorage.getItem(key) ?? "[]") as HistoryEntry[];
      localStorage.setItem(key, JSON.stringify([entry, ...entries]));
      return true;
    } catch {
      return false;
    }
  }

  async function shareBill() {
    const text = [title.trim() || "Split Bill", ...shares.map((person) => `${person.name}: ${rupiah(person.total)}`)].join("\n");
    updateDraft({ feedback: "", confirmSent: false });
    const pending = readDraft();
    const nativeShare = Boolean(navigator.share);
    try {
      if (navigator.share) {
        await navigator.share({ text });
      } else {
        await navigator.clipboard.writeText(text);
      }
    } catch (error) {
      if (readDraft() === pending && !(error instanceof DOMException && error.name === "AbortError")) {
        updateDraft({ feedback: "Ringkasan tagihan belum bisa dibagikan." });
      }
      return;
    }

    if (readDraft() === pending) {
      updateDraft({ confirmSent: true, feedback: nativeShare ? "" : "Ringkasan disalin. Tempel dan kirim ke kontak tujuan." });
    }
  }

  if (step === "source") {
    return <SourcePicker source={draft.selectedSource} feedback={feedback} onSelect={(selectedSource) => updateDraft({ selectedSource })}
      onContinue={(selected) => {
      updateDraft({
        source: selected, feedback: "", step: selected === "struk" ? "upload" : "manual",
        ...(selected !== source ? { items: [blankItem], photoUrl: "" } : {}),
      });
    }} />;
  }

  if (step === "upload") {
    return <SplitScreen title="Unggah Struk" description="Pilih foto langsung atau dari galeri untuk menyiapkan struk."
      action="Tinjau hasil contoh" disabled={!photoUrl} onBack={() => setStep("source")}
      onSubmit={() => {
        updateDraft({ items: items.some((item) => item.name) ? items : exampleItems, step: "review" });
      }}>
      <section className={`${card} bg-green-light!`}>
        <h2 className="font-semibold">Pilih sumber foto</h2>
        <div className="grid grid-cols-2 gap-3">
          {([{ mode: "camera", label: "Foto langsung", detail: "Ambil foto struk saat ini." },
            { mode: "gallery", label: "Dari galeri", detail: "Pilih foto struk yang sudah tersimpan." }] as const).map(({ mode, label, detail }) =>
            <label key={mode} className={`relative cursor-pointer rounded-[20px] p-3 ${photoMode === mode ? "bg-green text-bone" : "bg-cream"} focus-within:outline-2`}>
              <span className="block text-sm font-semibold">{label}</span>
              <span className="mt-1 block text-[11px]/[15px]">{detail}</span>
              <input type="file" accept="image/*" capture={mode === "camera" ? "environment" : undefined}
                aria-label={label} className="sr-only" onChange={(event) => {
                  const file = event.currentTarget.files?.[0];
                  if (!file) return;
                  updateDraft({ photoMode: mode, photoUrl: URL.createObjectURL(file), items: [blankItem] });
                }} />
            </label>)}
        </div>
      </section>
      <section className={card}>
        <h2 className="text-sm font-bold">Preview struk</h2>
        {photoUrl
          // A local blob URL is created from the selected file.
          // eslint-disable-next-line @next/next/no-img-element
          ? <img alt="Foto struk yang dipilih" src={photoUrl} className="max-h-56 w-full rounded-2xl bg-cream object-contain" />
          : <p className="rounded-2xl bg-cream p-3 text-xs">Pilih foto untuk melihat preview.</p>}
      </section>
      <Note>OCR belum terhubung. Langkah berikutnya menampilkan item contoh yang bisa kamu ubah sesuai struk.</Note>
    </SplitScreen>;
  }

  if (step === "manual" || step === "review") {
    const review = step === "review";
    return <SplitScreen title={review ? "Tinjau Hasil" : "Catat Manual"}
      description={review ? "Sesuaikan item dan total dengan strukmu." : "Tulis item, harga, dan jumlah pesanan secara manual."}
      action="Tambah peserta" onBack={() => setStep(review ? "upload" : "source")} onSubmit={() => setStep("people")}
      disabled={!items.length || subtotal === 0 || items.some((item) => !item.name.trim() || item.price === "")}>
      <section className={`${card} ${review ? "bg-green-light!" : ""}`}>
        <h2 className="text-sm font-bold">{review ? "Hasil ekstraksi contoh" : "Item pesanan"}</h2>
        <label className="block text-xs">Nama tagihan
          <input className={field} value={title} maxLength={80} onChange={(event) => updateDraft({ title: event.target.value })} placeholder="Nama warung atau acara" />
        </label>
        <div className="grid grid-cols-2 gap-2">
          {items.map((item, index) => <fieldset key={item.id} aria-label={`Item ${index + 1}`} className="min-w-0 space-y-1.5 rounded-2xl bg-cream p-2">
            <label className="block text-xs">Nama item
              <input required className={field} value={item.name} maxLength={80} onChange={(event) => editItem(item.id, { name: event.target.value })} />
            </label>
            <label className="block text-xs">Jumlah
              <input required type="number" min="1" max="999" className={field} value={item.quantity || ""} onChange={(event) => editItem(item.id, { quantity: Number(event.target.value) })} />
            </label>
            <label className="block text-xs">Harga satuan (Rp)
              <input required type="number" min="0" max="100000000" className={field} value={item.price}
                onChange={(event) => {
                  const value = event.target.value;
                  editItem(item.id, { price: value === "" ? "" : Number(value) });
                }} />
            </label>
            <button type="button" className="text-xs underline" onClick={() => updateDraft({ items: items.filter((entry) => entry.id !== item.id) })}>Hapus item</button>
          </fieldset>)}
        </div>
        <button type="button" className="text-xs font-semibold underline" onClick={() => updateDraft({ items: [...items, { ...blankItem, id: crypto.randomUUID() }] })}>Tambah item</button>
        <label className="block text-xs">Pajak (%)
          <input type="number" min="0" max="100" className={field} value={rate} onChange={(event) => updateDraft({ rate: Number(event.target.value) })} />
        </label>
        <BillTotal subtotal={subtotal} tax={tax} rate={rate} />
      </section>
      <Note>Setelah item dan harga sesuai, tambahkan peserta dan tentukan siapa yang menanggung setiap pesanan.</Note>
    </SplitScreen>;
  }

  if (step === "people") {
    return <SplitScreen title="Tambah Peserta" description="Tambah anggota dan tentukan pesanan masing-masing."
      action="Lihat hasil akhir" onBack={() => setStep(source === "struk" ? "review" : "manual")}
      onSubmit={openResult} disabled={people.some((person) => !person.name.trim())}>
      <section className={card}>
        <h2 className="text-sm font-bold">Peserta</h2>
        {people.map((person, index) => <label key={person.id} className="block text-xs">
          {index === 0 ? "Namamu" : `Nama peserta ${index + 1}`}
          <input required className={field} maxLength={60} value={person.name} onChange={(event) => {
            const name = event.target.value;
            updateDraft({ people: people.map((entry) => entry.id === person.id ? { ...entry, name } : entry) });
          }} />
        </label>)}
        <button type="button" className="text-xs font-semibold underline" onClick={() => updateDraft({ people: [...people, { id: crypto.randomUUID(), name: "" }] })}>Tambah peserta</button>
      </section>
      <section className={card}>
        <h2 className="text-sm font-bold">Pembagian pesanan</h2>
        {items.map((item) => <label key={item.id} className="block text-xs">
          {item.name} · {item.quantity} × {rupiah(Number(item.price))}
          <select className={field} value={item.owner} onChange={(event) => editItem(item.id, { owner: event.target.value })}>
            <option value="all">Semua peserta (bagi rata)</option>
            {people.map((person) => <option key={person.id} value={person.id}>{person.name}</option>)}
          </select>
        </label>)}
      </section>
      <Note>Pesanan bersama dibagi rata. Pajak dibagi menurut porsi nilai pesanan setiap peserta.</Note>
    </SplitScreen>;
  }

  return <SplitScreen title="Hasil Akhir" description="Lihat total tagihan tiap peserta setelah pembagian selesai."
    action="Bagikan tagihan" onBack={() => setStep("people")} onSubmit={() => void shareBill()}>
    <section className={`${card} bg-green-light!`}>
      <h2 className="text-sm font-bold">Rincian tagihan</h2>
      <BillTotal subtotal={subtotal} tax={tax} rate={rate} />
    </section>
    <section className={card}>
      <h2 className="text-sm font-bold">Bagian peserta</h2>
      <ul className="space-y-2">
        {shares.map((person, index) => <li key={person.id} className="flex items-center gap-2">
          <span aria-hidden="true" className={`grid size-7 shrink-0 place-items-center rounded-full text-xs font-semibold ${index === 0 ? "bg-yellow" : "bg-green-light"}`}>
            {person.name.trim().slice(0, 1).toUpperCase()}
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold [overflow-wrap:anywhere]">{person.name}{index === 0 && person.name !== "Kamu" ? " (kamu)" : ""}</p>
            <p className="text-xxs text-[#52725c]">{rupiah(person.amount)} + pajak {rupiah(person.tax)}</p>
          </div>
          <strong className="text-xs">{rupiah(person.total)}</strong>
        </li>)}
      </ul>
    </section>
    <Note>Total tagihan tiap peserta mencakup pesanan dan pembagian pajak proporsional.</Note>
    <Link href="/riwayat?tab=split-bill" className="self-start text-xs font-semibold underline">Lihat riwayat Split Bill</Link>
    {feedback && <p role="status" className="text-xs">{feedback}</p>}
    {confirmSent && <section className={card} aria-label="Konfirmasi pengiriman">
      <p className="text-xs">Sudah mengirim ringkasan ke kontak tujuan?</p>
      <p className="text-xxs">Setelah menjawab, kamu akan kembali ke awal Split Bill.</p>
      <div className="flex flex-wrap gap-3 text-xs font-semibold">
        <button type="button" className="underline" onClick={() => {
          updateDraft({ ...emptyDraft, feedback: "Tagihan belum dicatat ke riwayat." });
        }}>Belum dikirim</button>
        <button type="button" className="rounded-lg bg-green px-3 py-2 text-bone" onClick={() => {
          if (!readDraft().confirmSent) return;
          if (saveSharedBill()) {
            updateDraft({ ...emptyDraft, feedback: "Tagihan dicatat ke riwayat." });
          } else {
            updateDraft({ feedback: "Riwayat tidak dapat disimpan di browser ini." });
          }
        }}>Sudah saya kirim</button>
      </div>
    </section>}
  </SplitScreen>;
}
