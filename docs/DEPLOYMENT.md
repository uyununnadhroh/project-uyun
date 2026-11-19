# Checklist produksi

1. **Database** — PostgreSQL terkelola (Supabase, Neon, RDS, dll.). Untuk Supabase pakai *connection string* Postgres (gunakan connection pooler bila serverless). Jalankan `npx prisma migrate deploy` lalu `npm run db:seed`.
2. **Environment** — `AUTH_SECRET` acak 32+ karakter (`openssl rand -hex 32`), `DATABASE_URL`, `STORAGE_DIR`. Jangan commit `.env`.
3. **Storage** — aplikasi menyimpan file di disk (`STORAGE_DIR`). Di VPS/Docker gunakan volume persisten dan backup rutin. Untuk platform serverless (disk tidak persisten), ganti implementasi `src/lib/storage.ts` ke Supabase Storage/S3 (bucket privat untuk `proofs`).
4. **Proses** — `npm run build` lalu `npm start` di belakang reverse proxy HTTPS (cookie `Secure` aktif di produksi). Rate limit bersifat in-memory per instance; untuk multi-instance pindahkan ke Redis.
5. **OCR** — Tesseract berjalan di server (CPU). Data bahasa disalin otomatis dari `node_modules/@tesseract.js-data` ke `STORAGE_DIR/tessdata`. Dapat dimatikan di Settings.
6. **Setelah deploy** — login admin, ganti password, isi Settings, rekening bank, dan menu dengan foto asli. Hapus produk contoh bila sempat menjalankan `db:seed-demo`.
7. **Backup** — `pg_dump` terjadwal + backup folder storage.
