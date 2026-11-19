/** Parser hasil OCR bukti transfer (murni, tanpa dependensi server — mudah diuji). */

export const MONTHS: Record<string, number> = {
  jan: 1, januari: 1, january: 1, feb: 2, februari: 2, february: 2, mar: 3, maret: 3, march: 3, apr: 4, april: 4,
  mei: 5, may: 5, jun: 6, juni: 6, june: 6, jul: 7, juli: 7, july: 7, agu: 8, agt: 8, ags: 8, agustus: 8, aug: 8, august: 8,
  sep: 9, sept: 9, september: 9, okt: 10, oktober: 10, oct: 10, october: 10, nov: 11, november: 11, des: 12, desember: 12, dec: 12, december: 12,
};

/** Ubah "125.000", "125,000.00", "125.000,00", "Rp125000" -> 125000 */
export function parseAmount(raw: string): number | null {
  let s = raw.replace(/[^\d.,]/g, "");
  if (!s) return null;
  s = s.replace(/[.,]\d{2}$/, (m) => (/[.,]\d{3}$/.test(s) ? m : "")); // buang desimal 2 digit
  const n = parseInt(s.replace(/[.,]/g, ""), 10);
  return Number.isFinite(n) ? n : null;
}

export function extractFromText(text: string, expected: number) {
  const clean = text.replace(/\r/g, "");
  const amounts: number[] = [];
  const rpRegex = /(?:rp|idr)\s*\.?\s*:?\s*([\d][\d.,\s]{2,})/gi;
  let m: RegExpExecArray | null;
  const prefixed: number[] = [];
  while ((m = rpRegex.exec(clean))) {
    const n = parseAmount(m[1].replace(/\s/g, ""));
    if (n && n >= 1000) prefixed.push(n);
  }
  const sepRegex = /\b\d{1,3}(?:[.,]\d{3})+(?:[.,]\d{2})?\b/g;
  while ((m = sepRegex.exec(clean))) {
    const n = parseAmount(m[0]);
    if (n && n >= 1000) amounts.push(n);
  }
  const all = [...prefixed, ...amounts];
  const exact = all.find((n) => n === expected);
  const amount = exact ?? prefixed[0] ?? (amounts.length ? Math.max(...amounts) : null);

  // Tanggal
  let date: string | null = null;
  const d1 = clean.match(/\b(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})\b/);
  const d2 = clean.match(/\b(\d{1,2})\s+([A-Za-z]{3,9})\.?\s+(\d{4})\b/);
  if (d2 && MONTHS[d2[2].toLowerCase()]) date = `${d2[1].padStart(2, "0")}/${String(MONTHS[d2[2].toLowerCase()]).padStart(2, "0")}/${d2[3]}`;
  else if (d1) date = `${d1[1].padStart(2, "0")}/${d1[2].padStart(2, "0")}/${d1[3].length === 2 ? "20" + d1[3] : d1[3]}`;

  // Nama pengirim (heuristik)
  let sender: string | null = null;
  const lines = clean.split("\n").map((l) => l.trim()).filter(Boolean);
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    const mm = l.match(/(?:nama pengirim|pengirim|dari|from|sender|sumber dana)\s*[:\-]?\s*(.*)$/i);
    if (mm) {
      const candidate = (mm[1] || lines[i + 1] || "").replace(/[^A-Za-z .']/g, "").trim();
      if (candidate.length >= 3) {
        sender = candidate.slice(0, 60);
        break;
      }
    }
  }
  return { amount, matched: exact != null, date, sender, candidates: [...new Set(all)].slice(0, 10) };
}

