# OmniRoute — Gerbang AI Multi-Penyedia

**Satu endpoint untuk menghubungkan banyak penyedia AI.** OmniRoute membantu mengelola model, akun, kunci API, perutean, fallback, penggunaan, dan layanan AI dari satu dasbor.

[Dokumentasi utama](../../../README.md) · [Repositori](https://github.com/kuro-myths/omni-router) · [Situs resmi upstream](https://omniroute.online) · [Laporkan masalah](https://github.com/kuro-myths/omni-router/issues)

> Bahasa antarmuka bawaan proyek ini telah diatur ke Bahasa Indonesia. Beberapa istilah teknis tetap memakai istilah aslinya agar konsisten dengan API dan dokumentasi penyedia.

## Fitur utama

- **Gateway multi-penyedia:** satukan akses ke berbagai layanan model AI melalui satu endpoint kompatibel OpenAI.
- **Manajemen akun dan kredensial:** kelola koneksi OAuth dan API key dari dasbor.
- **Pemilihan model dan perutean:** atur model, alias, kombinasi, serta strategi fallback.
- **Fallback otomatis:** alihkan permintaan ketika jalur model atau penyedia mengalami gangguan, sesuai konfigurasi.
- **Observabilitas:** pantau permintaan, token, biaya, kesehatan penyedia, batas, dan log.
- **Alat pengembang:** endpoint API, playground, translator, MCP, A2A, serta integrasi CLI yang tersedia di upstream.
- **Keamanan:** lindungi dasbor dan endpoint dengan kata sandi serta API key.

Daftar fitur dan dukungan penyedia mengikuti versi upstream dan dapat berubah.

## Mulai cepat secara lokal

Persyaratan: Node.js 22.x, npm, dan ruang penyimpanan persisten.

```bash
git clone https://github.com/kuro-myths/omni-router.git
cd omni-router
npm install
cp .env.example .env
openssl rand -base64 48
openssl rand -hex 32
```

Gunakan nilai acak yang dihasilkan untuk `JWT_SECRET`, `API_KEY_SECRET`, dan `STORAGE_ENCRYPTION_KEY`. Tetapkan `INITIAL_PASSWORD` dengan kata sandi admin yang kuat sebelum menjalankan aplikasi.

```bash
npm run dev
```

Buka `http://localhost:20128`.

## Menjalankan dengan Docker

Docker Compose upstream memasang data pada volume persisten:

```bash
docker compose -f docker-compose.prod.yml up -d --build
docker compose -f docker-compose.prod.yml logs -f
```

Jangan hapus volume `omniroute-prod-data` saat memperbarui aplikasi.

## Deployment Vercel

Repository ini terhubung ke proyek Vercel **omni-router** dan dibangun dari branch `main`.

Environment variable yang perlu dikonfigurasi:

| Variabel | Kegunaan |
| --- | --- |
| `INITIAL_PASSWORD` | Kata sandi admin awal |
| `JWT_SECRET` | Secret sesi/token |
| `API_KEY_SECRET` | Secret API key |
| `STORAGE_ENCRYPTION_KEY` | Kunci enkripsi data |
| `NEXT_PUBLIC_BASE_URL` | URL publik deployment |
| `BASE_URL` | URL dasar server |

**Penting tentang penyimpanan:** upstream menggunakan SQLite dan direktori data lokal. Filesystem runtime Vercel bersifat sementara; karena itu build yang berhasil belum menjamin data SQLite bertahan setelah instance diganti atau dijalankan ulang. Jangan simpan kredensial produksi sebelum adapter penyimpanan persisten dikonfigurasi dan diuji. Proyek Supabase yang disiapkan belum otomatis menggantikan SQLite; integrasi skema dan lapisan data harus dikerjakan secara eksplisit.

Simpan secret hanya pada environment variable Vercel. Jangan commit berkas `.env` atau menaruh API key pada kode frontend.

## Menghubungkan klien API

Setelah server siap dan API key dibuat dari menu Endpoint, gunakan URL dasar:

```text
https://ALAMAT-DEPLOYMENT-ANDA/v1
```

Contoh:

```bash
curl https://ALAMAT-DEPLOYMENT-ANDA/v1/models \
  -H "Authorization: Bearer API_KEY_ANDA"
```

## Menu dasbor

| Menu | Fungsi |
| --- | --- |
| Dasbor | Ringkasan koneksi dan status sistem |
| Penyedia | Mengelola koneksi AI |
| Kombinasi | Mengatur kumpulan model dan fallback |
| Penggunaan & Analitik | Memantau token, permintaan, dan biaya |
| Kesehatan & Batas | Memantau status serta kuota |
| Endpoint | Membuat API key dan melihat alamat API |
| Translator & Playground | Menguji format permintaan |
| Log & Audit | Meninjau aktivitas dan kesalahan |
| Pengaturan | Mengelola keamanan dan perilaku aplikasi |

## Pengujian

```bash
npm run lint
npm run test:unit
npm run build
```

Tes integrasi dan e2e memerlukan konfigurasi tambahan. Status build Vercel bukan bukti bahwa seluruh endpoint, OAuth, penyimpanan, dan koneksi provider telah berfungsi; pengujian runtime tetap diperlukan.

## Keamanan

1. Gunakan kata sandi admin yang unik dan kuat.
2. Simpan secret hanya pada environment variable.
3. Rotasi kredensial yang pernah terpapar atau dicurigai bocor.
4. Batasi akses dasbor dan API key.
5. Cadangkan data persisten dan uji pemulihannya.
6. Jangan mengirim file `.env`, token, atau secret melalui issue publik.

## Kredit dan lisensi

OmniRoute dikembangkan oleh kontributor upstream. Repository ini merupakan salinan kerja untuk deployment dan penyesuaian. Hormati lisensi dan atribusi pada berkas [LICENSE](../../../LICENSE) serta repository upstream.
