# Phase 1 Technical Execution Plan

Dokumen ini memecah `PHASE 1: Core Engine - Features Integration` menjadi backlog teknis yang bisa langsung dieksekusi.

## 1. Objective Phase 1

Target fase ini adalah membangun **core engine lokal** untuk operasi dokumen dasar yang stabil, modular, dan siap dipakai ulang oleh UI di Phase 3.

Output fase ini sebaiknya berupa:
- library Python yang bisa dipanggil dari CLI, UI, atau test
- kontrak input/output yang konsisten untuk semua fitur
- validasi error yang jelas
- temporary file handling yang aman
- logging dan progress hooks sederhana

---

## 2. Arsitektur yang Direkomendasikan

```text
src/document_tools/
├── exceptions.py
├── models.py
├── features/
│   ├── merge.py
│   ├── split.py
│   └── pdf_utils.py
```

### Prinsip desain
- **feature-oriented modules**: setiap kelompok fitur punya service sendiri
- **pure core logic**: tidak tergantung UI
- **typed request/response models**: memudahkan validasi dan testing
- **replaceable backends**: implementasi library bisa diganti tanpa mengubah kontrak publik

---

## 3. Prioritas Implementasi

### Sprint 1 — Fondasi
1. Struktur package Python
2. Model data bersama (`DocumentInput`, `PageRange`, `OperationResult`)
3. Custom exceptions
4. Validasi input dasar
5. Unit test untuk model dan validator

### Sprint 2 — PDF Merge / Split
1. Merge banyak PDF
2. Split PDF per halaman tunggal
3. Split PDF per rentang halaman
4. Hapus halaman PDF
5. Reorder halaman PDF
6. Rotasi halaman PDF

### Sprint 3 — PDF Utilities Lanjutan
1. Protect PDF
2. Unlock PDF
3. Watermark PDF
4. Compress PDF

### Sprint 4 — Word Engine Dasar
1. Merge DOCX
2. Split DOCX by section break
3. Eksplorasi split DOCX per halaman/range

### Sprint 5 — Mixed Merge
1. DOCX + PDF -> PDF
2. DOCX + PDF -> DOCX (eksperimental/high-risk)

---

## 4. Rekomendasi Library per Fitur

| Fitur | Library utama | Catatan |
|---|---|---|
| PDF merge/split/reorder/rotate/protect/unlock | `pypdf` | Cocok untuk operasi halaman dan enkripsi |
| Watermark PDF | `pypdf` + PDF template overlay | Bisa dibuat dari PDF watermark terpisah |
| Compress PDF | `pypdf` (limited) / Ghostscript wrapper | Kompresi nyata sering butuh tool eksternal |
| Merge DOCX | `python-docx` + `docxcompose` | Lebih aman daripada merge manual XML |
| Split DOCX by section break | `python-docx` / low-level XML | Perlu parsing struktur dokumen |
| Split DOCX by page | LibreOffice / layout engine | `python-docx` tidak punya konsep page layout final |
| DOCX -> PDF | LibreOffice headless / `docx2pdf` | Penting untuk mixed merge output PDF |

### Catatan risiko penting
Fitur berikut **secara teknis lebih kompleks** dari yang terlihat:
- **Split Word per halaman / range halaman**
- **Merge campuran PDF + Word dengan output Word**

Alasannya: format `.docx` tidak menyimpan page layout final secara andal seperti PDF. Pagination bergantung pada rendering engine. Karena itu, dua fitur di atas sebaiknya dianggap **advanced/experimental**, walau tetap tercantum di roadmap.

---

## 5. Backlog Teknis per Fitur

### 5.1 Merge PDF
**Definition of Done**
- menerima banyak file PDF
- urutan file dipertahankan
- output satu file PDF baru
- gagal dengan pesan jelas bila input kosong / file rusak / terenkripsi tanpa password

**Subtask**
- validasi semua file berekstensi `.pdf`
- buka file satu per satu dengan backend PDF
- append halaman ke writer
- simpan output
- test merge 2-3 file sederhana

### 5.2 Merge Word
**Definition of Done**
- menerima banyak file `.docx`
- urutan file dipertahankan
- style dasar, paragraf, dan tabel ikut terbawa sebisa mungkin

**Subtask**
- gunakan `docxcompose` sebagai jalur utama
- fallback error jelas bila dokumen rusak
- test merge dokumen teks + tabel

### 5.3 Merge PDF & Word
**Strategi teknis yang direkomendasikan**
- **Output PDF**: konversi semua `.docx` ke PDF sementara, lalu merge seluruh antrean sebagai PDF
- **Output DOCX**: tandai sebagai eksperimen; butuh PDF -> representasi Word yang tidak lossless

**Rekomendasi eksekusi**
- implementasikan **output PDF dulu**
- jadikan **output DOCX** sebagai item setelah engine konversi matang di Phase 2

### 5.4 Split PDF
**Mode**
- per halaman tunggal
- per rentang halaman

**Subtask**
- parser range (`1`, `3-7`, `1,3,5-6`)
- validasi batas halaman
- hasilkan file output per potongan
- test range valid dan invalid

### 5.5 Split Word
**Mode realistis**
- by section break: realistis untuk Phase 1
- by page / page range: high-risk, perlu renderer

**Rekomendasi**
- implementasi `section break` lebih dulu
- dokumentasikan bahwa split by page akan bergantung pada LibreOffice/layout engine

### 5.6 PDF Utilities
**Delete Pages**
- hapus halaman berdasarkan indeks/range

**Rotate Pages**
- hanya izinkan `90`, `180`, `270`

**Reorder Pages**
- input urutan baru harus mencakup semua halaman tanpa duplikasi

**Protect / Unlock**
- support user password
- validasi password kosong sesuai policy

**Watermark**
- support teks watermark sederhana lebih dulu
- posisi default: center diagonal atau center horizontal

**Compress**
- definisikan level dukungan sejak awal:
  - `basic`: rewrite PDF, optimasi ringan
  - `advanced`: wrapper Ghostscript bila tersedia

---

## 6. Urutan Implementasi yang Paling Aman

1. `models.py`
2. `exceptions.py`
3. `features/merge.py` untuk PDF dulu
4. `features/split.py` untuk PDF dulu
5. `features/pdf_utils.py`
6. tambah Word merge
7. tambah Word split by section
8. mixed merge output PDF

Urutan ini mengurangi risiko karena mayoritas fitur Phase 1 sebenarnya lebih matang di domain PDF daripada Word.

---

## 7. Kontrak Data yang Disarankan

### `DocumentInput`
- `path`
- `document_type`
- `password` opsional

### `PageRange`
- `start`
- `end`
- helper untuk validasi dan ekspansi indeks

### `OperationResult`
- `success`
- `output_files`
- `message`
- `metadata`

---

## 8. Testing Strategy

### Unit tests
- validasi input
- parser page range
- enum routing feature
- error handling dasar

### Integration tests
- merge 2 PDF
- split PDF 1 file jadi banyak file
- delete/reorder/rotate PDF
- merge 2 DOCX sederhana

### Fixture yang perlu disiapkan nanti
- PDF 1 halaman
- PDF multi halaman
- DOCX dengan paragraf
- DOCX dengan tabel
- DOCX dengan section break
- PDF terenkripsi

---

## 9. Risiko dan Keputusan Scope

### Bisa diselesaikan stabil di Phase 1
- merge PDF
- split PDF
- delete/rotate/reorder PDF
- protect/unlock PDF
- watermark PDF
- merge DOCX
- split DOCX by section break

### Perlu batasan eksplisit
- compress PDF berkualitas tinggi
- split Word per halaman/range
- merge campuran dengan output DOCX

### Keputusan scope yang saya sarankan
Untuk menjaga Phase 1 tetap realistis:
- jadikan **PDF engine** sebagai deliverable utama
- jadikan **Word page-based split** dan **mixed merge output DOCX** sebagai fitur experimental

---

## 10. Definition of Ready untuk Mulai Coding

Sebelum implementasi fitur, pastikan proyek punya:
- `pyproject.toml`
- package `src/document_tools`
- baseline test `pytest`
- folder fixture tests
- keputusan backend konversi DOCX <-> PDF (LibreOffice headless vs tool lain)

---

## 11. Next Step yang Paling Bernilai

Jika ingin lanjut langsung ke coding, urutan paling efektif adalah:
1. implement `models.py` dan `exceptions.py`
2. implement `MergeService` untuk PDF
3. implement `SplitService` untuk PDF
4. tambah test integrasi untuk PDF

Dengan urutan ini, kita bisa punya MVP Phase 1 yang benar-benar jalan lebih cepat.
