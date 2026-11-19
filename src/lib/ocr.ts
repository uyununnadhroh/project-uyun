import "server-only";
import path from "path";
import { promises as fs } from "fs";
import { prisma } from "./db";
import sharp from "sharp";
import { readFile } from "./storage";
import { extractFromText } from "./ocr-parse";

/**
 * OCR bukti transfer dengan Tesseract.js (berjalan lokal di server, data bahasa dari npm).
 * PENTING: OCR hanyalah ALAT BANTU untuk admin. Hasilnya tidak membuktikan keaslian transfer —
 * keputusan akhir selalu dilakukan admin dengan mengecek mutasi rekening.
 */

const TESSDATA = path.resolve(process.cwd(), process.env.STORAGE_DIR || "./storage", "tessdata");

async function ensureLangData() {
  await fs.mkdir(TESSDATA, { recursive: true });
  for (const lang of ["ind", "eng"]) {
    const target = path.join(TESSDATA, `${lang}.traineddata.gz`);
    try {
      await fs.access(target);
    } catch {
      const src = path.resolve(process.cwd(), "node_modules/@tesseract.js-data", lang, "4.0.0_best_int", `${lang}.traineddata.gz`);
      await fs.copyFile(src, target);
    }
  }
}

export async function runOcrForProof(proofId: string) {
  const proof = await prisma.paymentProof.findUnique({ where: { id: proofId }, include: { payment: true } });
  if (!proof) return;
  try {
    await ensureLangData();
    const { createWorker, PSM } = await import("tesseract.js");
    const worker = await createWorker(["ind", "eng"], 1, {
      langPath: TESSDATA,
      cachePath: TESSDATA,
      gzip: true,
    });
    try {
      // Pra-proses: grayscale + normalisasi kontras + perbesar agar teks kecil/besar sama-sama terbaca
      const raw = await readFile(proof.filePath);
      const meta = await sharp(raw).metadata();
      const width = Math.min(2400, Math.max(1600, meta.width ?? 1600));
      const image = await sharp(raw).resize({ width }).grayscale().normalize().sharpen().png().toBuffer();
      const first = await worker.recognize(image);
      let text = (first.data.text || "").trim();
      let confidence = first.data.confidence;
      let res = extractFromText(text, proof.payment.amount);
      if (!res.matched) {
        // Pass kedua: mode "sparse text" sering lebih baik untuk tangkapan layar m-banking
        await worker.setParameters({ tessedit_pageseg_mode: PSM.SPARSE_TEXT });
        const second = await worker.recognize(image);
        const text2 = (second.data.text || "").trim();
        const res2 = extractFromText(`${text}\n${text2}`, proof.payment.amount);
        if (res2.matched || (res.amount == null && res2.amount != null)) {
          res = { ...res2, date: res.date ?? res2.date, sender: res.sender ?? res2.sender };
          text = `${text}\n---\n${text2}`;
          confidence = Math.max(confidence, second.data.confidence);
        }
      }
      const readable = text.length >= 10;
      let note: string;
      if (!readable) note = "Teks pada gambar tidak terbaca. Periksa manual.";
      else if (res.matched) note = "Nominal yang terbaca sama dengan total pesanan. Tetap cek mutasi rekening sebelum menyetujui.";
      else if (res.amount != null) note = `Nominal terbaca (${res.amount.toLocaleString("id-ID")}) berbeda dengan total pesanan.`;
      else note = "Nominal tidak ditemukan pada gambar.";
      await prisma.paymentProof.update({
        where: { id: proofId },
        data: {
          ocrStatus: readable && res.matched ? "MATCH" : "NEEDS_REVIEW",
          ocrText: text.slice(0, 5000),
          ocrAmount: res.amount,
          ocrDate: res.date,
          ocrSenderName: res.sender,
          ocrConfidence: typeof confidence === "number" ? confidence : null,
          ocrNote: note,
        },
      });
    } finally {
      await worker.terminate();
    }
  } catch (e) {
    console.error("[ocr] gagal", e);
    await prisma.paymentProof.update({
      where: { id: proofId },
      data: { ocrStatus: "FAILED", ocrNote: "OCR gagal dijalankan. Periksa bukti secara manual." },
    });
  }
}
