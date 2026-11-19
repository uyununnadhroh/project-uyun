# Hakuu Bakery — Website E-Commerce

Sistem pemesanan roti online untuk UMKM **Hakuu Bakery**: katalog & pemesanan untuk customer (tanpa akun), dan dashboard admin untuk produk, pesanan, verifikasi pembayaran, kapasitas produksi, serta laporan penjualan.

**Stack:** Next.js 15 (App Router, Server Actions) · TypeScript · Tailwind CSS v4 · PostgreSQL + Prisma · Tesseract.js (OCR) · Recharts · ExcelJS / jsPDF

Dokumentasi lanjutan:
- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — analisis kebutuhan, arsitektur, ERD, flowchart pemesanan & pembayaran, aturan bisnis
- [`docs/WHATSAPP.md`](docs/WHATSAPP.md) — integrasi WhatsApp & jalur upgrade ke WhatsApp Business API
- [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) — checklist produksi (Supabase, storage, keamanan)

## Menjalankan secara lokal

Prasyarat: Node.js 20+ dan PostgreSQL 14+ (atau Docker).

```bash
npm install
```

```bash
cp .env.example .env
```

Edit `.env`: isi `AUTH_SECRET` (`openssl rand -hex 32`), `ADMIN_EMAIL`, `ADMIN_PASSWORD`.

Jalankan PostgreSQL (lewati bila sudah punya):

```bash
docker compose up -d
```

Buat tabel & data dasar (akun admin, kategori Roti/Paket Hemat, varian Cokelat/Keju/Strawberry/Blueberry/Vanilla/Abon):

```bash
npx prisma migrate deploy
```

```bash
npm run db:seed
```

Opsional — 6 produk **contoh** untuk mencoba alur (bukan menu resmi; ubah/hapus lewat dashboard):

```bash
npm run db:seed-demo
```

```bash
npm run dev
```

- Website: http://localhost:3000
- Admin: http://localhost:3000/admin (login dengan `ADMIN_EMAIL` / `ADMIN_PASSWORD`)

### Setelah login pertama kali (wajib)
1. **Settings** → isi nomor WhatsApp Business, alamat, jam operasional, Instagram, ongkir, slot waktu, kapasitas produksi harian, hari libur, foto hero.
2. **Bank Accounts** → tambahkan rekening (metode Transfer hanya muncul bila ada rekening aktif).
3. **Products** → unggah menu & **foto produk asli** Hakuu Bakery. Untuk paket, pilih jenis *Paket*, isi jumlah isi & centang varian.
4. Ganti password admin di **Settings → Akun admin**.

## Struktur folder

```
prisma/              schema.prisma, migrations, seed.ts (dasar), seed-demo.ts (contoh)
public/brand/        logo & monogram Hakuu (diolah dari file logo resmi)
scripts/             e2e-test.ts + run-e2e.sh (test end-to-end)
src/app/(shop)/      halaman customer: home, menu, detail, keranjang, checkout, pesanan, lacak
src/app/admin/       login, dashboard (panel), invoice, cetak laporan, actions.ts (server actions)
src/app/api/         route handler: cart quote, orders, proof upload, track, files, admin export
src/components/      ui/ (komponen dasar), shop/ (customer), admin/ (dashboard)
src/lib/             logika bisnis: order-service, payment-service, ocr, reports, storage, auth, settings
```

## Test

```bash
npm run typecheck
```

Test end-to-end (36 skenario: alur customer & admin, paket dinamis, cash, transfer + OCR + tolak/terima, kapasitas & race condition, stok, laporan, export, keamanan, responsive). Berjalan pada database terpisah `hakuu_bakery_test`, butuh `npm run build` terlebih dahulu dan paket `playwright` + Chromium:

```bash
npm run build
```

```bash
npm run test:e2e
```

## Catatan penting
- **OCR hanya alat bantu.** Sistem tidak dapat memastikan keaslian transfer dari gambar. Admin wajib mencocokkan mutasi rekening sebelum menekan *Terima Pembayaran*.
- **Tombol WhatsApp = Click-to-Chat.** Pesan baru terkirim saat customer menekan *Kirim* di WhatsApp. Sistem tidak menganggap pesan sudah terkirim.
- Semua harga & total dihitung ulang di server; harga dari browser diabaikan.
