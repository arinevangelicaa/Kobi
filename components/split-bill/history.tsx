"use client";

import { useCallback, useSyncExternalStore } from "react";
import { exampleHistory, historyKey, rupiah, type HistoryEntry } from "./history-data";

function subscribe(listener: () => void) {
  window.addEventListener("storage", listener);
  return () => window.removeEventListener("storage", listener);
}

export default function SplitBillHistory({ userId }: { userId?: string }) {
  const snapshot = useCallback(() => {
    try {
      return userId ? localStorage.getItem(historyKey(userId)) ?? "[]" : "[]";
    } catch {
      return "[]";
    }
  }, [userId]);
  const serialized = useSyncExternalStore(subscribe, snapshot, () => "[]");
  let saved: HistoryEntry[] = [];
  try {
    const parsed = JSON.parse(serialized);
    if (Array.isArray(parsed)) saved = parsed;
  } catch {
    // Example entries remain available when local history is unreadable.
  }
  const entries = saved.length ? saved : exampleHistory;

  return <>
    <ul className="space-y-2.5">
      {entries.map((entry) => (
        <li key={entry.id} className="space-y-1.5 rounded-[20px] bg-green-light p-3">
          <h2 className="text-sm/5 font-semibold [overflow-wrap:anywhere]">{entry.title}</h2>
          <div className="mt-2 flex flex-wrap justify-between gap-x-2 text-[11px]/4">
            <p className="text-[#52725c]">{entry.date}</p>
            <p>{entry.people} peserta</p>
          </div>
          <dl className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <dt className="text-xxs text-[#52725c]">Total tagihan</dt>
              <dd className="text-sm font-bold">{rupiah(entry.total)}</dd>
            </div>
            <div className="flex items-center gap-3 rounded-xl bg-bone px-2.5 py-2">
              <dt className="text-xxs text-[#52725c]">Bagianmu</dt>
              <dd className="text-sm font-bold">{rupiah(entry.share)}</dd>
            </div>
          </dl>
          <p className="text-xxs/4 text-[#52725c]">
            Pesananmu {rupiah(entry.share - entry.tax)} {entry.tax ? `+ pajak ${rupiah(entry.tax)}` : "· tanpa pajak"} = {rupiah(entry.share)}
          </p>
        </li>
      ))}
    </ul>
    <p className="text-xxs text-[#52725c]">
      {saved.length ? "Riwayat tersimpan di browser ini." : "Data contoh. Tagihanmu akan muncul setelah pembagian selesai."}
    </p>
  </>;
}
