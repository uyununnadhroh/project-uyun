# Deployment Hakuu Bakery

## Konfigurasi Vercel

Gunakan Node.js 24.x, preset Next.js, dan root repositori. `vercel.json` menetapkan `npm run build` tanpa menjalankan seed. Proyek Vercel yang dipakai adalah `hakuu-bakery-web` dari `uyununnadhroh/project-uyun` dengan production branch `main`. Project Supabase tujuan Production adalah `hakuu-bakery-web` (project ref `pafzryrwlvvpvytvddht`). Perubahan environment hanya berlaku pada deployment berikutnya.

| Variabel | Isi |
| --- | --- |
| `DATABASE_URL` | Connection string PostgreSQL yang dapat diakses runtime Vercel. Bila memakai pooler Supabase, gunakan koneksi yang disarankan untuk aplikasi serverless dan koneksi sesi/langsung untuk migrasi. |
| `AUTH_SECRET` | String acak minimal 32 karakter, khusus setiap environment. |
| `SUPABASE_URL` | URL dasar proyek Supabase Storage, misalnya `https://<project-ref>.supabase.co`. |
| `SUPABASE_SERVICE_ROLE_KEY` | Kunci server dengan akses service role di proyek Storage tersebut. Simpan di environment Vercel tanpa prefiks `NEXT_PUBLIC_`. |

`ADMIN_EMAIL` dan `ADMIN_PASSWORD` dipakai oleh seed awal yang dijalankan terpisah. Audit Production menemukan kolom opsional `product_variants."packagePrice"` sudah bertipe INTEGER dan tabel `_prisma_migrations` belum ada. Perbaikan ini dapat membaca kolom yang sudah ada. Untuk Production, buat baseline Prisma berdasarkan skema yang benar-benar aktif sebelum menjalankan migrasi berikutnya. Tinjau perbedaan skema dan siapkan backup sebelum mengubah riwayat migrasi.

## Supabase Storage

Buat atau verifikasi bucket berikut di **Storage → Buckets** pada proyek Supabase yang ditunjuk `SUPABASE_URL`.

| Nama bucket | Visibilitas | Tipe file yang dipakai aplikasi |
| --- | --- | --- |
| `product-images` | Publik untuk baca foto katalog dan situs | `image/jpeg`, `image/png`, `image/webp` |
| `payment-proofs` | Privat | `image/jpeg`, `image/png` |

Tetapkan batas bucket yang mengizinkan file sampai 4 MiB. Aplikasi membatasi satu bukti atau total foto produk baru per simpan hingga 4 MiB agar request multipart muat dalam batas standar Vercel. Admin dapat menambahkan foto dalam beberapa tahap dengan membuka kembali produk yang telah tersimpan.

Upload dan baca bukti menggunakan service role dari server. Pada **Storage → Policies**, pastikan role `anon` maupun `authenticated` tidak mendapat akses langsung ke `payment-proofs` melalui kebijakan bucket atau kebijakan global yang juga mencakup bucket itu. Biarkan RLS aktif. URL bukti yang dipakai aplikasi hanya tersedia melalui `/api/files/proofs/…` dengan pengecekan sesi admin atau akses pesanan pembeli. Database menyimpan `proofs/<nama-file>`; aplikasi membaca file baru dari root bucket dan juga mendukung objek lama di folder `proofs/` dalam bucket tersebut. Jika pernah menyimpan bukti di disk pada deploy lama, salin file yang masih tersedia ke bucket privat dengan nama yang cocok dengan `payment_proofs.filePath`.

Untuk audit baca saja dari SQL Editor Supabase:

```sql
select id, public, file_size_limit, allowed_mime_types
from storage.buckets
where id in ('product-images', 'payment-proofs');

select policyname, roles, cmd, qual, with_check
from pg_policies
where schemaname = 'storage' and tablename = 'objects';
```

## Verifikasi

Preview saat ini bisa selesai build, tetapi runtime melaporkan bahwa `DATABASE_URL` belum tersedia. `SUPABASE_URL` dan `SUPABASE_SERVICE_ROLE_KEY` juga hanya tersedia di Production. Gunakan database uji lokal yang sudah tersedia dengan simulasi Storage untuk menguji operasi tulis. PR dapat di-review tanpa menyediakan proyek cloud tambahan.

1. Jalankan `npm ci`, `npm run build`, `npm run typecheck`, lalu `npm run test:e2e` dengan fixture lokal. Audit Production dapat memeriksa katalog dan Runtime Logs secara baca saja.
2. Simpan satu produk biasa, satu paket dengan varian aktif, dan satu draf. Cek panel admin dan katalog. Coba kategori di HP dan desktop sambil menggunakan pencarian.
3. Coba harga isi paket dari menu **Admin → Varian Paket**. Jika semua varian yang dipilih memiliki harga, jumlah harga varian menjadi harga paket. Jika ada harga varian yang kosong, checkout memakai harga paket dari form produk, termasuk diskon paket jika ada.
4. Buat pesanan transfer uji, unggah gambar JPG/PNG, lalu buka bukti dari **Admin → Pesanan → detail pesanan**. Uji lagi URL bukti dari browser tanpa sesi dan pastikan responsnya 403.
5. Jika upload gagal, periksa Vercel Runtime Logs untuk POST `/api/orders/<nomor>/proof` atau POST Server Action pada `/admin/produk/baru`. Cari 413/`FUNCTION_PAYLOAD_TOO_LARGE`, pesan `[storage]` yang menyebut bucket, atau `[admin] database error` seperti Prisma P2021/P2022. Periksa nama dan scope variabel di **Settings → Environment Variables** dan redeploy Preview setelah perubahan.

OCR berjalan setelah respons upload dengan data bahasa yang ikut dibundel. Jika log memuat `[ocr] gagal`, admin tetap bisa memeriksa bukti secara manual. Untuk produksi, gunakan backup database dan backup objek Storage.

Setelah PR disetujui, pastikan deployment Production dari `main` membawa commit yang sudah di-review. Bila environment berubah, verifikasi deployment baru memakai pengaturan terbaru. Jika upload kecil masih gagal, gunakan waktu kejadian untuk mencocokkan Runtime Logs Vercel dengan respons Storage Supabase.
