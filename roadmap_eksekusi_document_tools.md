# Roadmap Eksekusi Project: Python Document Tools

Dokumen ini berisi rencana eksekusi pembangunan aplikasi manajemen dokumen lokal secara bertahap (per phase).

---

## PHASE 1: Core Engine - Features Integration

### 1. Fitur Penggabungan (Merge)
* **Merge PDF**
    * Menggabungkan beberapa file PDF secara berurutan menjadi satu file PDF baru.
* **Merge Word**
    * Menggabungkan beberapa file Word (`.docx`) secara berurutan menjadi satu file Word baru.
* **Merge PDF & Word**
    * Menggabungkan file PDF dan Word yang disusun secara acak dalam satu antrean, dengan opsi output berupa file PDF atau Word.

### 2. Fitur Pemisahan (Split)
* **Split PDF**
    * Memotong PDF per halaman tunggal.
    * Memotong PDF berdasarkan rentang halaman tertentu (misal: halaman 3-7).
* **Split Word**
    * Memotong file Word per halaman tunggal.
    * Memotong file Word berdasarkan rentang halaman tertentu.
    * Memotong file Word berdasarkan *section break* yang ada di dalam dokumen.

### 3. Fitur PDF Utilities
* **Delete Pages:** Menghapus halaman spesifik dari file PDF.
* **Rotate Pages:** Memutar orientasi halaman PDF yang miring (90, 180, 270 derajat).
* **Reorder Pages:** Menyusun ulang urutan halaman PDF berdasarkan urutan indeks baru.
* **Compress PDF:** Memperkecil ukuran file PDF untuk optimasi penyimpanan/upload.
* **Protect PDF:** Menambahkan enkripsi password pada file PDF.
* **Unlock PDF:** Menghilangkan password dari file PDF yang terproteksi.
* **Watermark PDF:** Menambahkan teks transparan di latar belakang halaman PDF untuk keamanan.

---

## PHASE 2: Conversion & Extraction Engine

### 1. Fitur Konversi (Convert)
* **PDF to Word:** Mengonversi file PDF menjadi dokumen Word (`.docx`) dengan mempertahankan layout.
* **Word to PDF:** Mengonversi file Word menjadi PDF secara instan.
* **PDF to Excel:** Mengekstrak tabel dari PDF dan memasukkannya ke format Excel (`.xlsx`).
* **Excel to PDF:** Mengonversi lembar kerja Excel menjadi format PDF siap cetak.
* **PDF to Image:** Mengonversi halaman-halaman PDF menjadi file gambar (JPG/PNG) per halaman.
* **Image to PDF:** Menggabungkan satu atau beberapa file gambar menjadi satu file PDF.
* **PDF to Markdown:** Mengonversi teks PDF menjadi format Markdown (`.md`) bersih.
* **Word to Markdown:** Mengonversi dokumen Word menjadi format Markdown (`.md`).

### 2. Fitur Ekstraksi (Extract)
* **Extract Text:** Mengambil seluruh teks mentah dari file PDF atau Word menjadi file `.txt`.
* **Extract Images:** Mengotomatisasi pengambilan seluruh aset gambar yang tertanam di dalam PDF atau Word dan menyimpannya ke folder terpisah.

---

## PHASE 3: Interface & Distribution (Tampilan & Aplikasi)

### 1. Pengembangan User Interface (UI)
* Membangun interface lokal yang bersih dan modern (Opsi: Streamlit untuk web-app lokal cepat, atau CustomTkinter untuk GUI desktop asli).
* Implementasi fitur *drag-and-drop* file untuk mempermudah input dokumen.
* Penambahan *progress bar* dan notifikasi status (sukses/gagal) saat proses dokumen berjalan.

### 2. Finisihing & Build (.exe)
* Optimasi performa penanganan file berukuran besar secara lokal.
* *Packaging* seluruh script Python menjadi satu file aplikasi *executable* (`.exe`) menggunakan PyInstaller, sehingga aplikasi bisa dijalankan langsung di Windows tanpa perlu menginstall Python lagi.
