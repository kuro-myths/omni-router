# OmniRoute — Gerbang AI Multi-Penyedia

**Satu endpoint untuk menghubungkan banyak penyedia AI.** OmniRoute membantu mengelola model, akun, kunci API, perutean, fallback, penggunaan, dan layanan AI dari satu dasbor.

[Dokumentasi utama](../../../README.md) · [Repositori](https://github.com/kuro-myths/omni-router) · [Situs resmi upstream](https://omniroute.online) · [Laporkan masalah](https://github.com/kuro-myths/omni-router/issues)

> Bahasa antarmuka bawaan proyek ini telah diatur ke Bahasa Indonesia. Terjemahan beberapa istilah teknis mungkin tetap menggunakan istilah aslinya agar konsisten dengan API dan dokumentasi penyedia.

## Fitur utama

- **Gateway multi-penyedia:** satukan akses ke berbagai layanan model AI melalui satu endpoint kompatibel OpenAI.
- **Manajemen akun dan kredensial:** kelola koneksi OAuth dan API key dari dasbor.
- **Pemilihan model dan perutean:** atur model, alias, kombinasi, serta strategi fallback.
- **Fallback otomatis:** alihkan permintaan ketika jalur model atau penyedia mengalami gangguan, sesuai konfigurasi.
- **Observabilitas:** pantau permintaan, token, biaya, kesehatan penyedia, batas, dan log.
- **Alat pengembang:** endpoint API, playground, translator, MCP, A2A, serta integrasi CLI yang tersedia di upstream.
- **Pengaturan keamanan:** lindungi dasbor dan endpoint dengan kata sandi serta API key.

Daftar fitur dan dukungan penyedia dapat berubah mengikuti versi upstream. Periksa halaman dokumentasi dan catatan rilis untuk detail terbaru.

## Mulai cepat

### Menjalankan secara lokal

Persyaratan:
- Node.js 22.x direkomendasikan.
- npm.
- Ruang penyimpanan persisten untuk data aplikasi.

```bash
git clone https://github.com/kuro-myths/omni-router.git
cd omni-router
npm install
cp .env.example .env
```

Buat secret acak untuk konfigurasi keamanan:

```bash
openssl rand -base64 48
openssl rand -hex 32
```

Isi nilai hasil generator ke `JWT_SECRET`, `API_KEY_SECRET`, dan `STORAGE_ENCRYPTION_KEY` pada berkas `.env`. Tetapkan `INITIAL_PASSWORD` dengan kata sandi admin yang kuat sebelum menjalankan aplikasi.

```bash
npm run dev
```

Buka `http://localhost:20128`.

### Menjalankan dengan Docker

Gunakan Docker Compose upstream agar direktori data disimpan dalam volume:

```bash
docker compose -f docker-compose.prod.yml up -d --build
docker compose -f docker-compose.prod.yml logs -f
```

Pastikan volume `omniroute-prod-data` tetap terpasang. Jangan menghapus volume ketika memperbarui aplikasi.

## Deployment Vercel

Repository ini terhubung ke proyek Vercel **omni-router**. Vercel membangun aplikasi Next.js dari branch `main`.

Environment variable penting yang perlu dikonfigurasi pada Vercel:

| Variabel | Kegunaan |
| --- | --- |
| `INITIAL_PASSWORD` | Kata sandi admin awal |
| `JWT_SECRET` | Secret untuk sesi/token |
| `API_KEY_SECRET` | Secret untuk API key |
| `STORAGE_ENCRYPTION_KEY` | Kunci enkripsi data tersimpan |
| `NEXT_PUBLIC_BASE_URL` | URL publik deployment |
| `BASE_URL` | URL dasar server |

**Catatan penyimpanan:** OmniRoute upstream menggunakan SQLite dan direktori data lokal. Filesystem runtime Vercel bersifat sementara, sehingga konfigurasi Vercel saja belum menjamin data SQLite bertahan setelah instance diganti atau dijalankan ulang. Jangan gunakan deployment ini untuk menyimpan kredensial produksi sebelum adapter penyimpanan persisten telah dikonfigurasi dan diuji. Proyek Supabase yang disiapkan belum otomatis menjadi pengganti SQLite; integrasi skema dan lapisan data harus diselesaikan secara eksplisit.

Untuk deployment yang aman, gunakan environment variable terenkripsi di Vercel, jangan commit berkas `.env`, dan jangan menaruh API key di kode frontend.

## Konfigurasi klien API

Setelah server siap dan API key dibuat dari menu Endpoint, gunakan URL dasar:

```text
https://ALAMAT-DEPLOYMENT-ANDA/v1
```

Contoh permintaan kompatibel OpenAI:

```bash
curl https://ALAMAT-DEPLOYMENT-ANDA/v1/models \
  -H "Authorization: Bearer API_KEY_ANDA"
```

Gunakan nama model yang benar-benar tersedia pada koneksi penyedia Anda. Jangan membagikan API key atau token OAuth.

## Menu dasbor

| Menu | Fungsi |
| --- | --- |
| Dasbor | Ringkasan koneksi dan status sistem |
| Penyedia | Menambah dan mengelola koneksi AI |
| Kombinasi | Menentukan kumpulan model dan urutan fallback |
| Penggunaan & Analitik | Memantau token, permintaan, dan biaya |
| Kesehatan & Batas | Memantau status serta kuota penyedia |
| Endpoint | Membuat API key dan melihat alamat API |
| Translator & Playground | Menguji dan menyesuaikan format permintaan |
| Log & Audit | Meninjau aktivitas dan kesalahan |
| Pengaturan | Mengelola keamanan dan perilaku aplikasi |

## Pengujian dan pemeriksaan

Sebelum rilis, jalankan pemeriksaan yang sesuai dengan lingkungan:

```bash
npm run lint
npm run test:unit
npm run build
```

Tes integrasi dan e2e memerlukan konfigurasi layanan serta dependensi tambahan. Status build Vercel tidak sama dengan bukti seluruh endpoint, OAuth, penyimpanan, dan koneksi provider telah berfungsi; lakukan pengujian runtime setelah deployment.

## Keamanan

1. Gunakan kata sandi admin yang unik dan kuat.
2. Simpan secret hanya pada environment variable.
3. Rotasi kredensial OAuth/API yang pernah terpapar atau dicurigai bocor.
4. Batasi akses ke dasbor dan jangan aktifkan API key reveal tanpa kebutuhan.
5. Cadangkan data persisten dan uji proses pemulihannya.
6. Jangan mengirim file `.env`, token, atau secret melalui issue publik.

## Kredit dan lisensi

OmniRoute dikembangkan oleh kontributor upstream. Repository ini merupakan salinan kerja untuk deployment dan penyesuaian. Hormati lisensi serta atribusi yang tercantum pada berkas [LICENSE](../../../LICENSE) dan repository upstream.

