/**
 * Test end-to-end Hakuu Bakery (customer + admin) — jalankan terhadap DATABASE TERPISAH.
 *
 *   BASE_URL=http://localhost:3100 DATABASE_URL=postgresql://.../hakuu_bakery_test npm run test:e2e
 *
 * Membutuhkan paket `playwright` + browser Chromium (npx playwright install chromium).
 * Data yang dibuat oleh test diberi nama customer "E2E ..." dan berada di database test.
 */
import { chromium, type Page, type BrowserContext } from "playwright";
import sharp from "sharp";
import { PrismaClient } from "@prisma/client";
import path from "path";
import os from "os";

const BASE = process.env.BASE_URL || "http://localhost:3100";
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "admin@hakuu.local";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "GantiPassword123!";
const SHOTS = process.env.SHOTS_DIR || path.join(os.tmpdir(), "hakuu-e2e");
const prisma = new PrismaClient();

let passed = 0;
const failures: string[] = [];
async function test(name: string, fn: () => Promise<void>) {
  try {
    await fn();
    passed++;
    console.log(`  ✓ ${name}`);
  } catch (e) {
    failures.push(name);
    console.log(`  ✗ ${name}\n      ${(e as Error).message.split("\n").slice(0, 5).join("\n      ")}`);
  }
}
async function until(fn: () => Promise<boolean>, msg: string, ms = 15000) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    if (await fn()) return;
    await new Promise((r) => setTimeout(r, 300));
  }
  throw new Error(`timeout: ${msg}`);
}
const statusOf = async (id: string) => (await prisma.order.findUniqueOrThrow({ where: { id }, include: { payment: true } }));
function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

async function api(ctx: BrowserContext | null, method: string, url: string, body?: unknown) {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (ctx) headers.cookie = (await ctx.cookies(BASE)).map((c) => `${c.name}=${c.value}`).join("; ");
  const r = await fetch(BASE + url, { method, headers, body: body ? JSON.stringify(body) : undefined });
  const text = await r.text();
  let json: Record<string, unknown> = {};
  try {
    json = JSON.parse(text);
  } catch {}
  return { status: r.status, json, headers: r.headers };
}

async function proofImage(amountText: string) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="720" height="900"><rect width="100%" height="100%" fill="#ffffff"/>
  <text x="60" y="120" font-size="44" font-family="sans-serif" font-weight="bold">Transfer Berhasil</text>
  <text x="60" y="220" font-size="30" font-family="sans-serif">Tanggal: 18 Nov 2026</text>
  <text x="60" y="300" font-size="30" font-family="sans-serif">Nama Pengirim: BUDI SANTOSO</text>
  <text x="60" y="400" font-size="30" font-family="sans-serif">Nominal</text>
  <text x="60" y="470" font-size="56" font-family="sans-serif" font-weight="bold">${amountText}</text>
  <text x="60" y="570" font-size="28" font-family="sans-serif">Rekening Tujuan 1234567890</text></svg>`;
  const file = path.join(SHOTS, `proof-${Date.now()}.png`);
  await sharp(Buffer.from(svg)).png().toFile(file);
  return file;
}

async function adminLogin(page: Page) {
  await page.goto(`${BASE}/admin/login`);
  await page.fill("#email", ADMIN_EMAIL);
  await page.fill("#password", ADMIN_PASSWORD);
  await page.click("button[type=submit]");
  await page.waitForURL(`${BASE}/admin`);
}

async function main() {
  const fs = await import("fs");
  fs.mkdirSync(SHOTS, { recursive: true });
  const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH });
  const adminCtx = await browser.newContext({ viewport: { width: 1366, height: 900 } });
  const admin = await adminCtx.newPage();
  admin.setDefaultTimeout(10000);
  const custCtx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const cust = await custCtx.newPage();
  cust.setDefaultTimeout(10000);

  const pkg4 = await prisma.product.findFirstOrThrow({ where: { slug: "paket-hemat-isi-4" } });
  const roti = await prisma.product.findFirstOrThrow({ where: { slug: "roti-keju" } });
  const variants = await prisma.productVariant.findMany({ orderBy: { sortOrder: "asc" } });

  console.log("\n▶ Keamanan & proteksi");
  await test("Halaman admin tanpa login dialihkan ke /admin/login", async () => {
    const p = await (await browser.newContext()).newPage();
    await p.goto(`${BASE}/admin/pesanan`);
    assert(p.url().includes("/admin/login"), `url ${p.url()}`);
  });
  await test("API admin tanpa login → 401", async () => {
    const r = await api(null, "GET", "/api/admin/notifications");
    assert(r.status === 401, `status ${r.status}`);
    const e = await api(null, "GET", "/api/admin/reports/export?format=xlsx");
    assert(e.status === 401, `export status ${e.status}`);
  });
  await test("Login admin dengan password salah ditolak", async () => {
    await admin.goto(`${BASE}/admin/login`);
    await admin.fill("#email", ADMIN_EMAIL);
    await admin.fill("#password", "salah-banget");
    await admin.click("button[type=submit]");
    await admin.getByText("Email atau password salah").waitFor({ timeout: 5000 });
  });

  console.log("\n▶ Admin: konfigurasi toko");
  await test("Login admin & dashboard tampil", async () => {
    await adminLogin(admin);
    await admin.getByRole("heading", { name: "Dashboard" }).waitFor();
  });
  await test("Simpan pengaturan (WhatsApp, alamat, ongkir)", async () => {
    await admin.goto(`${BASE}/admin/pengaturan`);
    const field = (label: string) => admin.locator(`label:text-is("${label}") + *`).first();
    await field("Nomor WhatsApp Business").fill("0812-3456-7890");
    await field("Alamat usaha / pengambilan").fill("Jl. Contoh Uji No. 1 (data test)");
    await field("Biaya pengiriman (Rp, flat)").fill("10000");
    await admin.getByRole("button", { name: "Simpan Pengaturan" }).click();
    await admin.getByText("Pengaturan disimpan").waitFor();
    const wa = await prisma.setting.findUnique({ where: { key: "whatsappNumber" } });
    assert(wa?.value === "6281234567890", `wa=${JSON.stringify(wa?.value)}`);
  });
  await test("Tambah rekening bank", async () => {
    await admin.goto(`${BASE}/admin/rekening`);
    await admin.getByRole("button", { name: "Tambah Rekening" }).first().click();
    const dlg = admin.getByRole("dialog");
    await dlg.locator("input").nth(0).fill("BANK UJI");
    await dlg.locator("input").nth(1).fill("1234567890");
    await dlg.locator("input").nth(2).fill("Hakuu Test");
    await dlg.getByRole("button", { name: "Simpan" }).click();
    await admin.getByRole("cell", { name: "BANK UJI" }).waitFor();
  });
  await test("Validasi produk: harga diskon ≥ harga normal ditolak", async () => {
    await admin.goto(`${BASE}/admin/produk/baru`);
    await admin.locator("label:text-is('Nama produk') + input").fill("Produk Uji Validasi");
    await admin.locator("select").first().selectOption({ label: "Roti" });
    await admin.locator("label:text-is('Harga normal (Rp)') + input").fill("10000");
    await admin.locator("label:text-is('Harga diskon (opsional)') + input").fill("12000");
    await admin.getByRole("button", { name: "Simpan" }).click();
    await admin.getByText("Harga diskon harus lebih kecil").first().waitFor();
  });
  await test("Produk biasa tanpa foto tersimpan dan muncul setelah publikasi", async () => {
    const name = "Roti Uji Publikasi";
    await admin.goto(`${BASE}/admin/produk/baru`);
    await admin.getByPlaceholder("Roti Cokelat").fill(name);
    await admin.locator("select").first().selectOption({ label: "Roti" });
    await admin.getByPlaceholder("25000").fill("9000");
    await admin.getByRole("switch", { name: /Publikasi/ }).click();
    await admin.getByRole("button", { name: "Simpan", exact: true }).click();
    await admin.waitForURL(`${BASE}/admin/produk`);
    await admin.getByText(name, { exact: true }).first().waitFor();
    const product = await prisma.product.findUniqueOrThrow({ where: { slug: "roti-uji-publikasi" } });
    assert(!product.isPublished, "produk draf terpublikasi");
    await cust.goto(`${BASE}/menu?q=Roti+Uji+Publikasi`, { waitUntil: "networkidle" });
    await cust.getByRole("heading", { name: "Produk tidak ditemukan", exact: true }).first().waitFor();
    await admin.goto(`${BASE}/admin/produk/${product.id}`);
    await admin.getByRole("switch", { name: /Publikasi/ }).click();
    await admin.getByRole("button", { name: "Simpan", exact: true }).click();
    await admin.waitForURL(`${BASE}/admin/produk`);
    await cust.reload();
    await cust.getByRole("heading", { name }).waitFor();
  });
  await test("Buat paket dinamis isi 3 (tanpa duplikat) + upload foto", async () => {
    await admin.goto(`${BASE}/admin/produk/baru?tipe=PACKAGE`);
    await admin.locator("label:text-is('Nama paket') + input").fill("Paket Uji Isi 3");
    await admin.locator("select").first().selectOption({ label: "Paket Hemat" });
    await admin.locator("label:text-is('Harga paket (Rp)') + input").fill("36000");
    await admin.locator("label:has-text('Jumlah isi paket') + input").fill("3");
    await admin.getByRole("switch").first().click(); // matikan duplikat
    for (const n of ["Cokelat", "Keju", "Vanilla"]) await admin.locator("label", { hasText: new RegExp(`^${n}$`) }).locator("input").check();
    const photo = path.join(SHOTS, "photo.png");
    await sharp({ create: { width: 800, height: 800, channels: 3, background: "#d9a479" } }).png().toFile(photo);
    await admin.locator("input[type=file]").setInputFiles(photo);
    // preview menampilkan 3 slot
    assert((await admin.getByText(/^Pilihan \d$/).count()) === 3, "preview slot bukan 3");
    await admin.getByRole("button", { name: "Simpan" }).click();
    await admin.waitForURL(`${BASE}/admin/produk`);
    const p = await prisma.product.findFirstOrThrow({ where: { name: "Paket Uji Isi 3" }, include: { packageOptions: true, images: true } });
    assert(p.packageSize === 3 && !p.allowDuplicateVariants && p.packageOptions.length === 3 && p.images.length === 1, "konfigurasi paket tidak tersimpan");
  });

  console.log("\n▶ Customer: katalog, paket, keranjang");
  await test("Katalog: search, filter kategori, sort harga", async () => {
    await cust.goto(`${BASE}/menu?q=keju`);
    await cust.getByRole("heading", { name: "Roti Keju" }).waitFor();
    await cust.goto(`${BASE}/menu?kategori=paket-hemat&urut=price_desc`);
    const names = await cust.locator("article h3").allTextContents();
    assert(names[0] === "Paket Hemat Isi 4", `urutan: ${names.join(",")}`);
    assert(!names.includes("Roti Keju"), "filter kategori gagal");
  });
  for (const width of [390, 1280]) {
    await test(`Katalog ${width}px: pencarian, kategori, reset, dan hasil kosong`, async () => {
      const page = await custCtx.newPage();
      await page.setViewportSize({ width, height: 844 });
      page.setDefaultTimeout(10000);
      try {
        await page.goto(`${BASE}/menu`, { waitUntil: "networkidle" });
        const category = page.getByRole("combobox", { name: "Kategori produk" });
        const search = page.getByRole("textbox", { name: "Cari produk" });
        await search.fill("keju");
        await category.selectOption({ label: "Paket Hemat" });
        await page.waitForURL((url) => url.searchParams.get("kategori") === "paket-hemat" && url.searchParams.get("q") === "keju", { waitUntil: "networkidle" });
        await page.getByRole("heading", { name: "Paket Hemat", exact: true }).waitFor();
        await page.getByRole("heading", { name: "Produk tidak ditemukan", exact: true }).first().waitFor();
        assert(await search.inputValue() === "keju", "kategori menghilangkan kata kunci");
        await category.selectOption({ label: "Semua Produk" });
        await page.waitForURL((url) => !url.searchParams.get("kategori") && url.searchParams.get("q") === "keju", { waitUntil: "networkidle" });
        await page.getByRole("heading", { name: "Roti Keju" }).waitFor();
        assert(await search.inputValue() === "keju", "reset kategori menghilangkan kata kunci");
        assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), "filter melebar keluar layar");
        await search.fill("tidak-ada-hakuu");
        await page.getByRole("button", { name: "Cari", exact: true }).click();
        await page.getByRole("heading", { name: "Produk tidak ditemukan", exact: true }).first().waitFor();
      } finally {
        await page.close();
      }
    });
  }
  await test("Harga per varian bisa diatur admin dan digunakan oleh checkout", async () => {
    const chocolate = variants.find((v) => v.name === "Cokelat")!;
    await admin.goto(`${BASE}/admin/varian`);
    const row = admin.getByRole("row", { name: /Cokelat/ });
    const edit = () => row.getByRole("button", { name: "Edit" }).click();
    const price = admin.getByRole("dialog").locator("label", { hasText: "Harga per varian" }).locator("xpath=following-sibling::input");
    const save = () => admin.getByRole("dialog").getByRole("button", { name: "Simpan" }).click();
    await edit();
    await price.fill("13000");
    await save();
    await admin.getByRole("dialog").waitFor({ state: "hidden" });
    try {
      const quote = await api(null, "POST", "/api/cart/quote", { items: [{ productId: pkg4.id, quantity: 1, variants: Array(4).fill(chocolate.id) }] });
      assert(quote.json.subtotal === 52000 && quote.json.hasError === false, "harga varian tidak dipakai");
      const mixed = await api(null, "POST", "/api/cart/quote", { items: [{ productId: pkg4.id, quantity: 1, variants: [chocolate.id, chocolate.id, chocolate.id, variants.find((v) => v.name === "Keju")!.id] }] });
      assert(mixed.json.subtotal === 48000 && mixed.json.hasError === false, "harga paket tidak dipakai untuk varian tanpa harga");
    } finally {
      await edit();
      await price.fill("");
      await save();
      await admin.getByRole("dialog").waitFor({ state: "hidden" });
    }
  });
  await test("Paket isi 4: wajib memilih semua varian sebelum ditambahkan", async () => {
    await cust.goto(`${BASE}/menu/paket-hemat-isi-4`, { waitUntil: "networkidle" });
    assert((await cust.locator("select[id^=slot-]:visible").count()) === 4, "slot bukan 4");
    await cust.getByRole("button", { name: "Tambahkan ke Keranjang" }).click();
    await cust.getByText(/Pilih semua 4 varian/).waitFor();
    const picks = ["Cokelat", "Cokelat", "Keju", "Abon"];
    for (let i = 0; i < 4; i++) await cust.selectOption(`#slot-${i}`, { label: picks[i] });
    await cust.getByRole("button", { name: "Tambahkan ke Keranjang" }).click();
    await cust.getByText("ditambahkan ke keranjang").first().waitFor();
  });
  await test("Paket tanpa duplikat: varian yang sudah dipilih dinonaktifkan", async () => {
    const p = await prisma.product.findFirstOrThrow({ where: { name: "Paket Uji Isi 3" } });
    await cust.goto(`${BASE}/menu/${p.slug}`, { waitUntil: "networkidle" });
    await cust.selectOption("#slot-0", { label: "Cokelat" });
    const coklat = variants.find((v) => v.name === "Cokelat")!;
    const disabled = await cust.locator(`#slot-1:visible option[value="${coklat.id}"]`).isDisabled();
    assert(disabled, "opsi duplikat tidak dinonaktifkan");
  });
  await test("Tambah produk biasa & ubah jumlah di keranjang", async () => {
    await cust.goto(`${BASE}/menu/roti-keju`, { waitUntil: "networkidle" });
    await cust.getByRole("button", { name: "Tambahkan ke Keranjang" }).click();
    await cust.goto(`${BASE}/keranjang`, { waitUntil: "networkidle" });
    await cust.getByText("1. Cokelat").waitFor();
    await cust.getByRole("button", { name: "Tambah" }).nth(1).click(); // roti keju jadi 2
    await cust.getByText("Rp24.000").first().waitFor(); // 2 x 12.000 (harga diskon)
    await cust.getByText("Rp72.000").first().waitFor(); // 48.000 + 24.000
  });

  console.log("\n▶ Proteksi harga & validasi server");
  await test("Harga dari browser diabaikan (quote & order dihitung server)", async () => {
    const r = await api(null, "POST", "/api/cart/quote", { items: [{ productId: roti.id, quantity: 1, variants: [], price: 1, unitPrice: 1 }] });
    assert((r.json.subtotal as number) === 12000, `subtotal ${r.json.subtotal}`);
  });
  await test("Paket dengan jumlah varian kurang ditolak server", async () => {
    const r = await api(null, "POST", "/api/cart/quote", { items: [{ productId: pkg4.id, quantity: 1, variants: [variants[0].id] }] });
    assert(r.json.hasError === true, "harus error");
  });
  await test("Checkout dengan data tidak valid ditolak (422)", async () => {
    const r = await api(null, "POST", "/api/orders", { items: [{ productId: roti.id, quantity: 1 }], customerName: "A", phone: "123", fulfillmentMethod: "DELIVERY", deliveryAddress: "", scheduledDate: "2020-01-01", scheduledTime: "x", paymentMethod: "CASH" });
    assert(r.status === 422, `status ${r.status}`);
  });

  let transferOrder = "";
  console.log("\n▶ Checkout Transfer + bukti + OCR + verifikasi");
  await test("Checkout delivery + transfer via UI", async () => {
    await cust.goto(`${BASE}/checkout`, { waitUntil: "networkidle" });
    await cust.fill("#name", "E2E Budi Santoso");
    await cust.fill("#phone", "081299990001");
    await cust.getByRole("button", { name: /Delivery/ }).click();
    await cust.fill("#addr", "Jl. Uji Coba No. 10, Kel. Test, Kec. Test, Kota Test");
    await cust.fill("#landmark", "Pagar hitam");
    await cust.locator("button:not([disabled])", { hasText: "Tersedia" }).first().click();
    await cust.getByRole("button", { name: "08:00 - 10:00" }).click();
    await cust.getByRole("button", { name: /Transfer Bank/ }).click();
    await cust.getByText("BANK UJI").click();
    await cust.getByText("Rp82.000").first().waitFor(); // 72.000 + ongkir 10.000
    await cust.getByRole("button", { name: "Buat Pesanan" }).click();
    await cust.waitForURL(/\/pesanan\/HKU-/);
    transferOrder = cust.url().split("/pesanan/")[1].split("?")[0];
    const o = await prisma.order.findUniqueOrThrow({ where: { orderNumber: transferOrder }, include: { items: { include: { variants: true } }, payment: true } });
    assert(o.total === 82000 && o.deliveryFee === 10000, `total ${o.total}`);
    assert(o.status === "AWAITING_PAYMENT" && o.payment?.status === "UNPAID", "status awal salah");
    const pkgItem = o.items.find((i) => i.productType === "PACKAGE")!;
    assert(pkgItem.variants.length === 4 && pkgItem.variants.map((v) => v.variantName).join(",") === "Cokelat,Cokelat,Keju,Abon", "varian paket tidak tersimpan detail");
    assert(o.productionUnits === 6, `units ${o.productionUnits}`);
  });
  await test("Halaman pembayaran menampilkan rekening, nominal & batas waktu", async () => {
    await cust.getByText("1234567890").first().waitFor();
    await cust.getByText("Rp82.000").first().waitFor();
    await cust.getByText(/Bayar sebelum/).waitFor();
    await cust.screenshot({ path: path.join(SHOTS, "customer-payment.png"), fullPage: true });
  });
  await test("Akses pesanan orang lain tanpa verifikasi → 403", async () => {
    const r = await api(null, "GET", `/api/orders/${transferOrder}`);
    assert(r.status === 403, `status ${r.status}`);
  });
  await test("Upload file non-gambar ditolak", async () => {
    const fake = path.join(SHOTS, "fake.png");
    fs.writeFileSync(fake, "ini bukan gambar");
    const cookie = (await custCtx.cookies(BASE)).map((c) => `${c.name}=${c.value}`).join("; ");
    const fd = new FormData();
    fd.append("file", new Blob([fs.readFileSync(fake)], { type: "image/png" }), "fake.png");
    const r = await fetch(`${BASE}/api/orders/${transferOrder}/proof`, { method: "POST", body: fd, headers: { cookie } });
    assert(r.status === 422, `status ${r.status}`);
  });
  await test("Upload bukti melebihi 4 MiB ditolak dengan pesan ukuran", async () => {
    const file = { name: "besar.png", mimeType: "image/png", buffer: Buffer.alloc(4 * 1024 * 1024 + 1) };
    await cust.locator("input[type=file]").setInputFiles(file);
    await cust.getByRole("alert").filter({ hasText: "4 MiB" }).waitFor();
    const response = await custCtx.request.post(`${BASE}/api/orders/${transferOrder}/proof`, { multipart: { file } });
    assert(response.status() === 413 && (await response.json()).error.includes("4 MiB"), `status ${response.status()}`);
  });
  await test("Upload bukti transfer dengan preview → Menunggu Verifikasi", async () => {
    await cust.locator("input[type=file]").setInputFiles(await proofImage("Rp 80.000"));
    await cust.getByAltText("Preview bukti transfer").waitFor();
    await cust.getByRole("button", { name: "Kirim Bukti Pembayaran" }).click();
    await cust.getByText("Bukti pembayaran berhasil dikirim").first().waitFor();
    const o = await prisma.order.findUniqueOrThrow({ where: { orderNumber: transferOrder }, include: { payment: true } });
    assert(o.status === "AWAITING_VERIFICATION" && o.payment?.status === "WAITING_VERIFICATION", "status tidak berubah");
  });
  await test("OCR membaca nominal berbeda → Perlu Pemeriksaan", async () => {
    let proof;
    for (let i = 0; i < 60; i++) {
      proof = await prisma.paymentProof.findFirst({ where: { payment: { order: { orderNumber: transferOrder } } }, orderBy: { createdAt: "desc" } });
      if (proof && proof.ocrStatus !== "PENDING") break;
      await new Promise((r) => setTimeout(r, 1000));
    }
    assert(proof && proof.ocrStatus === "NEEDS_REVIEW", `ocr ${proof?.ocrStatus}`);
    assert(proof.ocrAmount === 80000, `ocrAmount ${proof.ocrAmount}`);
    console.log(`      (OCR: nominal ${proof.ocrAmount}, tanggal ${proof.ocrDate}, pengirim ${proof.ocrSenderName})`);
  });
  await test("Bukti privat: tidak bisa diakses tanpa hak", async () => {
    const proof = await prisma.paymentProof.findFirstOrThrow({ where: { payment: { order: { orderNumber: transferOrder } } } });
    const fileUrl = `${BASE}/api/files/${proof.filePath}`;
    const r = await fetch(fileUrl);
    assert(r.status === 403, `status ${r.status}`);
    for (const context of [custCtx, adminCtx]) {
      const response = await context.request.get(fileUrl);
      assert(response.ok() && response.headers()["cache-control"] === "private, no-store", "bukti tidak terbaca secara privat");
      assert((await response.body()).subarray(0, 4).toString("hex") === "89504e47", "isi bukti bukan PNG");
    }
    const order = await prisma.order.findUniqueOrThrow({ where: { orderNumber: transferOrder } });
    await admin.goto(`${BASE}/admin/pesanan/${order.id}`);
    const image = admin.getByAltText("Bukti transfer", { exact: true }).first();
    await image.waitFor();
    await until(() => image.evaluate((img: HTMLImageElement) => img.naturalWidth > 0), "admin dapat melihat bukti pada pesanan yang benar");
  });
  await test("Admin menolak bukti (alasan wajib) → customer bisa unggah ulang", async () => {
    await admin.goto(`${BASE}/admin/verifikasi`);
    await admin.getByText(transferOrder).waitFor();
    await admin.getByText("Perlu Pemeriksaan").first().waitFor();
    await admin.screenshot({ path: path.join(SHOTS, "admin-verification.png"), fullPage: true });
    await admin.getByRole("button", { name: "Tolak Pembayaran" }).click();
    await admin.getByRole("dialog").getByRole("button", { name: "Tolak" }).click();
    await admin.getByText("Wajib diisi, minimal 5 karakter.").waitFor();
    await admin.getByRole("dialog").locator("textarea").fill("Nominal transfer kurang dari total");
    await admin.getByRole("dialog").getByRole("button", { name: "Tolak" }).click();
    await admin.getByText("Bukti transfer ditolak").first().waitFor();
    await cust.reload();
    await cust.getByText("Nominal transfer kurang dari total").first().waitFor();
  });
  await test("Unggah ulang nominal benar → OCR cocok → admin terima → Lunas", async () => {
    await cust.locator("input[type=file]").setInputFiles(await proofImage("Rp 82.000"));
    await cust.getByRole("button", { name: "Kirim Bukti Pembayaran" }).click();
    await cust.getByText("Bukti pembayaran berhasil dikirim").first().waitFor();
    for (let i = 0; i < 60; i++) {
      const pr = await prisma.paymentProof.findFirst({ where: { payment: { order: { orderNumber: transferOrder } }, reviewStatus: "PENDING" } });
      if (pr && pr.ocrStatus !== "PENDING") {
        assert(pr.ocrStatus === "MATCH", `ocr ${pr.ocrStatus} amount ${pr.ocrAmount}`);
        break;
      }
      await new Promise((r) => setTimeout(r, 1000));
    }
    await admin.goto(`${BASE}/admin/verifikasi`);
    await admin.getByText("Nominal cocok").first().waitFor();
    await admin.getByRole("button", { name: "Terima Pembayaran" }).click();
    await admin.getByRole("dialog").getByRole("button", { name: "Ya, terima" }).click();
    await admin.getByText("Pembayaran diterima").first().waitFor();
    const o = await prisma.order.findUniqueOrThrow({ where: { orderNumber: transferOrder }, include: { payment: true } });
    assert(o.status === "PAYMENT_CONFIRMED" && o.payment?.status === "PAID", `status ${o.status}/${o.payment?.status}`);
  });
  await test("Halaman pelacakan customer diperbarui otomatis (tanpa reload)", async () => {
    await cust.getByText("Pembayaran telah diverifikasi").waitFor({ timeout: 15000 });
  });
  await test("Admin memproses sampai Selesai (riwayat status tercatat)", async () => {
    const o = await prisma.order.findUniqueOrThrow({ where: { orderNumber: transferOrder } });
    await admin.goto(`${BASE}/admin/pesanan/${o.id}`);
    for (const [label, st] of [["Masuk Jadwal Produksi", "SCHEDULED"], ["Sedang Diproduksi", "IN_PRODUCTION"], ["Packing", "PACKING"], ["Siap Diantar", "READY"], ["Dalam Pengiriman", "OUT_FOR_DELIVERY"], ["Selesai", "COMPLETED"]]) {
      await admin.getByRole("button", { name: new RegExp(`^${label}`) }).click();
      await admin.getByRole("dialog").getByRole("button", { name: "Simpan status" }).click();
      await until(async () => (await statusOf(o.id)).status === st, st);
      await admin.getByRole("dialog").waitFor({ state: "detached" });
    }
    const done = await prisma.order.findUniqueOrThrow({ where: { id: o.id }, include: { histories: true } });
    assert(done.status === "COMPLETED" && done.completedAt, "belum selesai");
    assert(done.histories.length >= 9, `histories ${done.histories.length}`);
    await admin.screenshot({ path: path.join(SHOTS, "admin-order-detail.png"), fullPage: true });
  });

  console.log("\n▶ Checkout Cash + lacak pesanan");
  let cashOrder = "";
  const guest = await (await browser.newContext()).newPage();
  await test("Checkout pick up + cash (API) → Menunggu Konfirmasi", async () => {
    const opts = await api(null, "GET", "/api/checkout/options");
    const day = (opts.json.days as { date: string; closed: boolean }[]).find((d) => !d.closed)!;
    const r = await api(null, "POST", "/api/orders", {
      items: [{ productId: roti.id, quantity: 3 }, { productId: pkg4.id, quantity: 1, variants: [variants[1].id, variants[2].id, variants[3].id, variants[4].id] }],
      customerName: "E2E Siti Cash", phone: "+62 812-9999-0002", fulfillmentMethod: "PICKUP", scheduledDate: day.date, scheduledTime: "10:00 - 12:00", paymentMethod: "CASH",
    });
    assert(r.status === 201, `status ${r.status} ${JSON.stringify(r.json)}`);
    cashOrder = r.json.orderNumber as string;
    const o = await prisma.order.findUniqueOrThrow({ where: { orderNumber: cashOrder }, include: { payment: true } });
    assert(o.total === 3 * 12000 + 48000 && o.status === "PENDING_CONFIRMATION" && o.payment?.status === "UNPAID", "data cash salah");
  });
  await test("Lacak pesanan: nomor WA salah ditolak, benar diterima", async () => {
    await guest.goto(`${BASE}/lacak`);
    await guest.fill("#no", cashOrder);
    await guest.fill("#wa", "081200000000");
    await guest.getByRole("button", { name: "Lacak Pesanan" }).click();
    await guest.getByText("Pesanan tidak ditemukan").waitFor();
    await guest.fill("#wa", "0812-9999-0002");
    await guest.getByRole("button", { name: "Lacak Pesanan" }).click();
    await guest.waitForURL(new RegExp(cashOrder));
    await guest.getByText("Pembayaran Cash").waitFor();
  });
  await test("Selesai tanpa lunas ditolak; tandai lunas lalu selesai", async () => {
    const o = await prisma.order.findUniqueOrThrow({ where: { orderNumber: cashOrder } });
    await admin.goto(`${BASE}/admin/pesanan/${o.id}`);
    const step = async (name: RegExp, st: string) => {
      await admin.getByRole("button", { name }).click();
      await admin.getByRole("dialog").getByRole("button", { name: "Simpan status" }).click();
      await until(async () => (await statusOf(o.id)).status === st, st);
      await admin.getByRole("dialog").waitFor({ state: "detached" });
    };
    await step(/Konfirmasi Pesanan/, "SCHEDULED");
    await step(/^Sedang Diproduksi/, "IN_PRODUCTION");
    await step(/^Packing/, "PACKING");
    await step(/^Siap Diambil/, "READY");
    assert((await admin.getByRole("button", { name: /^Dalam Pengiriman/ }).count()) === 0, "pick up tidak boleh 'Dalam Pengiriman'");
    await admin.getByRole("button", { name: /^Selesai/ }).click();
    await admin.getByRole("dialog").getByLabel(/tandai Lunas/).uncheck();
    await admin.getByRole("dialog").getByRole("button", { name: "Simpan status" }).click();
    await admin.getByText(/Pesanan belum lunas/).first().waitFor();
    assert((await statusOf(o.id)).status === "READY", "tidak boleh selesai saat belum lunas");
    await admin.getByRole("dialog").getByLabel(/tandai Lunas/).check();
    await admin.getByRole("dialog").getByRole("button", { name: "Simpan status" }).click();
    await until(async () => (await statusOf(o.id)).status === "COMPLETED", "COMPLETED");
    const done = await prisma.order.findUniqueOrThrow({ where: { id: o.id }, include: { payment: true } });
    assert(done.status === "COMPLETED" && done.payment?.status === "PAID", `${done.status}/${done.payment?.status}`);
  });

  console.log("\n▶ Pembatalan, stok & kapasitas");
  await test("Pembatalan wajib alasan, stok dikembalikan, tidak dihitung omzet", async () => {
    await prisma.product.update({ where: { id: roti.id }, data: { trackStock: true, stock: 5 } });
    const opts = await api(null, "GET", "/api/checkout/options");
    const day = (opts.json.days as { date: string; closed: boolean }[]).find((d) => !d.closed)!;
    const r = await api(null, "POST", "/api/orders", { items: [{ productId: roti.id, quantity: 4 }], customerName: "E2E Batal", phone: "081299990003", fulfillmentMethod: "PICKUP", scheduledDate: day.date, scheduledTime: "10:00 - 12:00", paymentMethod: "CASH" });
    assert(r.status === 201, `create ${r.status}`);
    assert((await prisma.product.findUniqueOrThrow({ where: { id: roti.id } })).stock === 1, "stok tidak berkurang");
    const over = await api(null, "POST", "/api/orders", { items: [{ productId: roti.id, quantity: 2 }], customerName: "E2E Lebih", phone: "081299990004", fulfillmentMethod: "PICKUP", scheduledDate: day.date, scheduledTime: "10:00 - 12:00", paymentMethod: "CASH" });
    assert(over.status === 400 || over.status === 409, `stok berlebih status ${over.status}`);
    const o = await prisma.order.findUniqueOrThrow({ where: { orderNumber: r.json.orderNumber as string } });
    await admin.goto(`${BASE}/admin/pesanan/${o.id}`);
    await admin.getByRole("button", { name: "Batalkan Pesanan" }).click();
    await admin.getByRole("dialog").locator("textarea").fill("Customer membatalkan via WhatsApp");
    await admin.getByRole("dialog").getByRole("button", { name: "Batalkan pesanan" }).click();
    await admin.getByText("Pesanan dibatalkan").first().waitFor();
    assert((await prisma.product.findUniqueOrThrow({ where: { id: roti.id } })).stock === 5, "stok tidak kembali");
    await prisma.product.update({ where: { id: roti.id }, data: { trackStock: false, stock: null } });
  });
  await test("Kapasitas harian penuh → tanggal ditolak & ditandai Penuh", async () => {
    const opts = await api(null, "GET", "/api/checkout/options");
    const day = (opts.json.days as { date: string; closed: boolean }[]).filter((d) => !d.closed)[2];
    await prisma.dailyProductionCapacity.upsert({ where: { date: new Date(`${day.date}T00:00:00Z`) }, update: { capacity: 4, isClosed: false }, create: { date: new Date(`${day.date}T00:00:00Z`), capacity: 4 } });
    const body = (qty: number, phone: string) => ({ items: [{ productId: roti.id, quantity: qty }], customerName: "E2E Kapasitas", phone, fulfillmentMethod: "PICKUP", scheduledDate: day.date, scheduledTime: "10:00 - 12:00", paymentMethod: "CASH" });
    // dua checkout bersamaan masing-masing 3 pcs: hanya satu yang boleh lolos
    const [a, b] = await Promise.all([api(null, "POST", "/api/orders", body(3, "081299990005")), api(null, "POST", "/api/orders", body(3, "081299990006"))]);
    const statuses = [a.status, b.status].sort();
    assert(statuses[0] === 201 && statuses[1] === 409, `statuses ${statuses}`);
    const after = await api(null, "GET", "/api/checkout/options");
    const d = (after.json.days as { date: string; remaining: number }[]).find((x) => x.date === day.date)!;
    assert(d.remaining === 1, `remaining ${d.remaining}`);
    await cust.goto(`${BASE}/menu/roti-keju`, { waitUntil: "networkidle" });
    await cust.getByRole("button", { name: "Tambahkan ke Keranjang" }).click();
    await cust.getByRole("button", { name: "Tambahkan ke Keranjang" }).click();
    await cust.goto(`${BASE}/checkout`, { waitUntil: "networkidle" });
    const dt = new Date(`${day.date}T00:00:00Z`).getUTCDate();
    const btn = cust.locator("button[disabled]", { hasText: "Sisa 1" }).filter({ hasText: String(dt) });
    await btn.first().waitFor();
  });

  console.log("\n▶ Laporan penjualan");
  await test("Omzet = hanya pesanan selesai & lunas (batal tidak dihitung)", async () => {
    await admin.goto(`${BASE}/admin/laporan?periode=daily`);
    await admin.getByText("Total omzet").waitFor();
    const expected = 82000 + 84000;
    await admin.getByText(`Rp${expected.toLocaleString("id-ID")}`).first().waitFor();
    await admin.screenshot({ path: path.join(SHOTS, "admin-reports.png"), fullPage: true });
  });
  await test("Export Excel & PDF", async () => {
    const x = await api(adminCtx, "GET", "/api/admin/reports/export?format=xlsx&periode=monthly");
    assert(x.status === 200 && (x.headers.get("content-type") || "").includes("spreadsheetml"), `xlsx ${x.status}`);
    const p = await api(adminCtx, "GET", "/api/admin/reports/export?format=pdf&periode=monthly");
    assert(p.status === 200 && p.headers.get("content-type") === "application/pdf", `pdf ${p.status}`);
  });
  await test("Dashboard menampilkan angka dari database", async () => {
    await admin.goto(`${BASE}/admin`);
    await admin.getByText("Rp166.000").first().waitFor();
    await admin.screenshot({ path: path.join(SHOTS, "admin-dashboard.png"), fullPage: true });
  });
  await test("Pesanan selesai tidak dapat dibatalkan/diarsipkan", async () => {
    const o = await prisma.order.findUniqueOrThrow({ where: { orderNumber: cashOrder } });
    await admin.goto(`${BASE}/admin/pesanan/${o.id}`);
    assert((await admin.getByRole("button", { name: "Batalkan Pesanan" }).count()) === 0, "tombol batal muncul");
    await admin.getByText(/tidak dapat dihapus/).waitFor();
  });

  console.log("\n▶ Responsive");
  await test("Tampilan mobile (iPhone) tanpa scroll horizontal", async () => {
    const m = await (await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true })).newPage();
    for (const [url, name] of [["/", "m-home"], ["/menu", "m-menu"], ["/menu/paket-hemat-isi-4", "m-package"], ["/checkout", "m-checkout"]]) {
      await m.goto(BASE + url, { waitUntil: "networkidle" });
      const overflow = await m.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      assert(overflow <= 1, `${url} overflow ${overflow}px`);
      await m.screenshot({ path: path.join(SHOTS, `${name}.png`), fullPage: true });
    }
  });

  await browser.close();
  await prisma.$disconnect();
  console.log(`\n${passed} lulus, ${failures.length} gagal${failures.length ? ":\n - " + failures.join("\n - ") : ""}`);
  console.log(`Screenshot: ${SHOTS}`);
  process.exit(failures.length ? 1 : 0);
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
