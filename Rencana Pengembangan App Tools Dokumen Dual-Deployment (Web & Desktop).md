# **Rencana Pengembangan App Tools Dokumen Dual-Deployment (Web & Desktop)**

---

Dokumen ini merancang strategi arsitektur, tumpukan teknologi (tech stack), fungsionalitas utama, serta alur eksekusi untuk membangun aplikasi manipulasi dokumen berprinsip *privacy-first*. Aplikasi ini memanfaatkan arsitektur *client-side processing* tunggal yang dapat disebarkan sebagai Web App (Vercel) dan Desktop App (.exe via Tauri) guna memenuhi kebutuhan portofolio serta kemudahan berbagi secara lokal.

## **1\. Visi & Strategi Arsitektur**

Kunci utama dari sistem ini adalah menjamin keamanan data pengguna dengan memproses seluruh dokumen secara 100% di sisi klien (browser/RAM lokal), tanpa mengirimkan berkas ke server eksternal. Dengan pendekatan satu basis kode (single codebase), aplikasi dapat di-deploy ke dua platform sekaligus:

* **Versi Web (Vercel):** Berfungsi sebagai demonstrasi langsung (live demo) untuk portofolio. Bebas biaya hosting serverless karena tidak menggunakan komputasi backend berat.  
* **Versi Desktop (.exe via Tauri):** Memungkinkan penggunaan offline penuh, tanpa keterbatasan batasan memori browser, serta mudah dibagikan sebagai berkas yang dapat dijalankan secara mandiri.

## **2\. Spesifikasi Tumpukan Teknologi (Tech Stack)**

| Komponen | Teknologi / Library | Alasan Pemilihan & Fungsi   |
| :---- | :---- | :---- |
| **Frontend Framework** | Next.js (React) / Vite React | Struktur komponen modular, performa tinggi, dan mendukung ekspor statis (SSG). |
| **Desktop Wrapper** | Tauri v2 | Ukuran biner sangat kecil (\< 15 MB), konsumsi RAM rendah, dan integrasi native Rust. |
| **Styling & UI** | Tailwind CSS \+ Shadcn/ui | Pengembangan antarmuka responsif, modern, dan konsisten di web maupun desktop. |
| **Pemrosesan PDF** | pdf-lib, pdfjs-dist | Manipulasi halaman (merge, split, rotate, watermark) 100% di sisi klien. |
| **Kompresi & Gambar** | browser-image-compression, Sharp (WASM) | Mengubah ukuran dan mengompresi format JPG/PNG/WebP secara lokal. |
| **Video & Media Engine** | @ffmpeg/ffmpeg (WASM) | Pemrosesan video/audio ringan berbasis WebAssembly di dalam browser/aplikasi. |

## **3\. Fitur Utama & Modul Fungsionalitas**

1. **Modul Manipulasi PDF:**  
   * *PDF Merger:* Menggabungkan beberapa berkas PDF menjadi satu.  
   * *PDF Splitter:* Memisah halaman PDF berdasarkan rentang yang ditentukan.  
   * *PDF Organizer:* Mengatur ulang urutan halaman, menghapus, atau memutar posisi halaman.  
2. **Modul Optimalisasi & Konversi Gambar:**  
   * *Image Compressor:* Mengurangi ukuran berkas gambar dengan opsi penyesuaian kualitas.  
   * *Format Converter:* Mengubah format gambar antar PNG, JPG, WebP, dan PDF.  
3. **Fitur Privasi & Keamanan:**  
   * *Zero-Server Data Guarantee:* Indikator status jaringan yang menunjukkan tidak ada berkas yang diunggah ke server.  
   * *Offline Mode (Desktop):* Operasi penuh tanpa memerlukan koneksi internet.

## **4\. Tahapan Pelaksanaan (Roadmap Pengembangan)**

### **Fase 1: Inisialisasi Proyek & Engine WebAssembly (Minggu 1\)**

* Inisialisasi repositori Next.js dengan arsitektur ekspor statis (output: 'export').  
* Membangun komponen UI dasar (Layout, File Uploader, Drag-and-Drop Zone).  
* Integrasi library pemrosesan PDF (pdf-lib) dan pengujian fungsi merge/split di browser.

### **Fase 2: Integrasi Tauri & Build Desktop (.exe) (Minggu 2\)**

* Inisialisasi Tauri pada repositori yang sama.  
* Konfigurasi alur build statis Next.js agar terhubung langsung dengan jendela aplikasi Tauri.  
* Melakukan pengujian kompilasi biner executable (.exe) untuk sistem operasi Windows.

### **Fase 3: Penyempurnaan UI/UX & Fitur Privasi (Minggu 3\)**

* Implementasi indikator privasi ("100% Processed Locally") pada antarmuka pengguna.  
* Penanganan batas memori (RAM) saat memproses file berukuran besar di browser.  
* Penambahan fitur kompresi gambar dan alat pendukung lainnya.

### **Fase 4: Deployment & Dokumentasi Portofolio (Minggu 4\)**

* Penerbitan web app ke platform Vercel.  
* Pembuatan halaman rilis GitHub (GitHub Releases) untuk distribusi berkas \`.exe\`.  
* Penyusunan file README.md yang mencakup dokumentasi arsitektur, bukti privasi data, serta panduan penanganan peringatan Windows SmartScreen.

## **5\. Panduan Mitigasi Keamanan & Windows SmartScreen**

Untuk mengatasi kendala False Positive atau peringatan "Unknown Publisher" dari Windows Defender pada versi \`.exe\` tanpa lisensi Code Signing berbayar, strategi berikut diterapkan:

| Langkah Mitigasi | Aksi Teknis   |
| :---- | :---- |
| **Microsoft WDSI Submission** | Mengunggah berkas biner \`.exe\` setiap rilis baru ke Microsoft Security Intelligence Portal untuk verifikasi status aman secara organik. |
| **Dokumentasi Reputasi** | Menyediakan panduan transparan di halaman README dan landing page web mengenai cara memilih *"More Info" → "Run Anyway"*. |
| **Prioritas Demo Web** | Mengarahkan perekrut atau penilai portofolio untuk menggunakan versi Vercel terlebih dahulu yang bebas dari hambatan instalasi. |

