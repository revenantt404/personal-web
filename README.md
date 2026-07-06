# Personal Minimal — Node.js + Tailwind

Website pribadi super clean & minimalist. Dibuat untuk portfolio 1 halaman, cepat, tanpa build step.

Stack:
- **Node.js + Express** — server statis + 1 API endpoint `/api/contact`
- **Tailwind CSS (CDN)** — tanpa build, langsung pakai
- Vanilla JS, 0 framework frontend
- Dark mode otomatis

### Struktur
```
personal-minimal/
├── server.js              # Express server
├── package.json
└── public/
    └── index.html         # 1 file, semua section
```

Section yang sudah ada:
1. Hero — headline editorial
2. Tentang
3. Karya pilihan — 4 project list
4. Catatan — blog list mini
5. Kontak — form POST ke /api/contact
6. Footer

### Jalankan lokal
```bash
cd personal-minimal
npm install
npm start
```
Buka: http://localhost:3000

Dev mode auto-reload:
```bash
npm run dev
```

### Kustomisasi cepat

Buka `public/index.html`, cari dan ganti:

- Nama / brand: `arga.` → nama kamu
  - Line ~43, ~60, footer ~220
- Email: `halo@arga.id` → email kamu (2 tempat)
- Hero headline: line 53-57
- Tentang: section `#tentang` line 80-95
- Karya: section `#karya` line 100-145 — duplikat `<article>`
- Catatan: list `<li>` line 155-170
- Sosial link: line 200-206
- Warna: di `tailwind.config` line 17-27
  - `paper: '#faf9f7'` — background light
  - `ink: '#1a1a1a'` — teks utama

### Deploy

- Vercel / Railway / Render: `node server.js`, PORT otomatis
- VPS: `pm2 start server.js --name personal`
- Static only: cukup upload `public/index.html` ke Netlify, form contact jadi non-aktif.

API contact saat ini cuma console.log. Integrasi gampang:
```js
// server.js -> app.post('/api/contact', ...)
// kirim ke Email: Resend / Nodemailer
// simpan ke: Supabase / Notion / Airtable
```

Mau saya personalisasiin dengan nama, foto, dan karya kamu? Kasih aja:
nama, tagline, 3-4 project, dan link sosial.
