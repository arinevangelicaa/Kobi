export type HistoryEntry = {
  id: string;
  title: string;
  date: string;
  people: number;
  total: number;
  share: number;
  tax: number;
};

const currency = new Intl.NumberFormat("id-ID");
export const rupiah = (value: number) => `Rp${currency.format(value)}`;
export const historyKey = (userId: string) => `kobi:split-bill:${userId}`;

export const exampleHistory: HistoryEntry[] = [
  { id: "demo-1", title: "Makan siang · Kantin FISIP", date: "17 Sept 2026 · 13.00", people: 4, total: 88000, share: 24200, tax: 2200 },
  { id: "demo-2", title: "Nugas bareng · Kopi Sudut", date: "16 Sept 2026 · 19.30", people: 3, total: 71500, share: 27500, tax: 2500 },
  { id: "demo-3", title: "Makan malam · Ayam Bakar", date: "15 Sept 2026 · 18.15", people: 5, total: 132000, share: 30800, tax: 2800 },
  { id: "demo-4", title: "Sarapan · Warung Bu Sari", date: "14 Sept 2026 · 08.00", people: 3, total: 54000, share: 19000, tax: 0 },
];
