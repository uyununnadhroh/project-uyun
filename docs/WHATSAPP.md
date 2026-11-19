# Integrasi WhatsApp

## Yang sudah berjalan: Click-to-Chat (wa.me)
Nomor diatur di **Admin → Settings → Kontak & WhatsApp**. Tombol yang tersedia:

| Lokasi | Pesan terisi otomatis |
|---|---|
| Tombol melayang di semua halaman toko, CTA homepage, footer | Pertanyaan umum menu & pemesanan |
| Halaman pesanan — *Kirim ringkasan ke WhatsApp* | No. pesanan, nama, metode & jadwal, alamat, daftar item + varian paket, ongkir, total, metode bayar, link lacak |
| Halaman pesanan — *Hubungi Hakuu Bakery* | Permintaan bantuan untuk nomor pesanan tsb |
| Setelah unggah bukti transfer — *Kabari admin via WhatsApp* | Konfirmasi bukti transfer + nominal |
| Admin → detail pesanan / customer — *Chat customer* | Update status pesanan |

**Penting:** tautan wa.me hanya *membuka* WhatsApp dengan pesan terisi. Pesan baru terkirim setelah pengguna menekan *Kirim*. Sistem tidak pernah mencatat bahwa pesan sudah terkirim. Notifikasi admin yang dijamin ada adalah notifikasi di dashboard (badge + toast, diperbarui setiap 20 detik).

## Upgrade opsional: WhatsApp Business Platform (Cloud API)
Untuk notifikasi otomatis (mis. "pembayaran diterima"), dibutuhkan akun Meta Business terverifikasi, nomor yang terdaftar di Cloud API, dan **template pesan yang disetujui** Meta (pesan yang dimulai oleh bisnis wajib memakai template). Titik integrasi yang disarankan:

- `src/lib/payment-service.ts` → setelah `approveProof` / `rejectProof`
- `src/lib/order-service.ts` → setelah `createOrder` dan `changeOrderStatus`

Simpan token di environment variable (mis. `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`), kirim di latar belakang (`after()`), dan catat status pengiriman dari webhook Meta — jangan menganggap pesan terkirim hanya karena request API berhasil.
