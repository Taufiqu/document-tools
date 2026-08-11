# Document Tools

Toolkit Python lokal untuk operasi dokumen, dimulai dari engine PDF pada Phase 1.

## Setup

```sh
python3 -m venv .venv
source .venv/bin/activate
pip install -e '.[phase1,dev]'
```

## Menjalankan test

```sh
pytest
```

## CLI

Setelah install editable, CLI tersedia sebagai:

```sh
document-tools --help
```

### Contoh command

#### Merge PDF
```sh
document-tools merge-pdf a.pdf b.pdf --output merged.pdf
```

#### Merge DOCX
```sh
document-tools merge-docx a.docx b.docx --output merged.docx
```

#### Merge campuran PDF + DOCX ke PDF
```sh
document-tools merge-mixed-pdf a.pdf b.docx c.pdf --output merged.pdf
```

#### Split DOCX per section break
```sh
document-tools split-docx source.docx --output-dir out
```

#### Split PDF per halaman
```sh
document-tools split-pdf source.pdf --output-dir out --single-pages
```

#### Split PDF per range
```sh
document-tools split-pdf source.pdf --output-dir out --ranges 1-2,4-5
```

#### Delete halaman
```sh
document-tools delete-pages source.pdf --output deleted.pdf --pages 2,4
```

#### Rotate halaman
```sh
document-tools rotate-pages source.pdf --output rotated.pdf --pages 1,3 --angle 90
```

#### Reorder halaman
```sh
document-tools reorder-pages source.pdf --output reordered.pdf --order 3,1,2
```

#### Compress PDF (Smart Vector & Rasterize)
```sh
# Smart mode (mengompresi stream gambar internal tanpa merusak ketajaman teks/vektor)
document-tools compress-pdf source.pdf --output compressed.pdf --mode smart --quality 60

# Rasterize mode (mengonversi tiap halaman ke gambar terkompresi, cocok untuk PDF hasil scan)
document-tools compress-pdf source.pdf --output compressed.pdf --mode rasterize --quality 60 --dpi 150
```

#### Generate Favicon & Web Icon Pack
```sh
# Buat file favicon.ico multi-resolusi
document-tools generate-favicon logo.png -o favicons/

# Buat complete web favicon pack (apple-touch, android-chrome, ico, png, & tag HTML)
document-tools generate-favicon logo.png -o favicons/ --web-pack
```

#### Protect PDF
```sh
document-tools protect-pdf source.pdf --output protected.pdf --password secret123
```

#### Unlock PDF
```sh
document-tools unlock-pdf protected.pdf --output unlocked.pdf --password secret123
```

#### Watermark PDF
```sh
document-tools watermark-pdf source.pdf --output watermarked.pdf --text CONFIDENTIAL --opacity 0.2
```

## Fitur yang sudah aktif

### PDF
- merge
- split per halaman
- split per range
- delete pages
- rotate pages
- reorder pages
- compress cerdas (Smart stream optimizer & Full rasterize)
- protect (enkripsi password)
- unlock (dekripsi password)
- watermark teks

### DOCX
- merge
- split by section break

### Gambar & Favicon
- Favicon .ico generator (multi-size: 16, 32, 48, 64, 128, 256)
- Complete Web Favicon Pack (Apple Touch Icon, Android Chrome, favicon.ico, PNG, & HTML tags)
- PDF to Images (PNG, JPG, WEBP, TIFF)
- Images to PDF (JPG, PNG, WEBP, TIFF, ICO)

### Mixed
- PDF + DOCX -> PDF (menggunakan LibreOffice headless)

---

## Phase 2 — Konversi & Ekstraksi

### Konversi PDF / DOCX / Gambar / Excel

#### PDF → Word
```sh
document-tools convert-pdf-to-docx source.pdf --output output.docx
```

#### Word → PDF
```sh
document-tools convert-docx-to-pdf source.docx --output output.pdf
```

#### PDF → Gambar (per halaman)
```sh
document-tools convert-pdf-to-images source.pdf --output-dir out/ --format png --dpi 150
```

#### Gambar → PDF
```sh
document-tools convert-images-to-pdf img1.png img2.jpg --output combined.pdf
```

#### PDF → Markdown
```sh
document-tools convert-pdf-to-md source.pdf --output output.md
```

#### Word → Markdown
```sh
document-tools convert-docx-to-md source.docx --output output.md
```

#### PDF → Excel (ekstrak tabel, best-effort)
```sh
document-tools convert-pdf-to-xlsx source.pdf --output output.xlsx
```

#### Excel → PDF
```sh
document-tools convert-xlsx-to-pdf source.xlsx --output output.pdf
```

### Ekstraksi konten

#### Ekstrak teks dari PDF atau DOCX
```sh
document-tools extract-text source.pdf --output text.txt
document-tools extract-text source.docx --output text.txt
```

#### Ekstrak gambar dari PDF atau DOCX
```sh
document-tools extract-images source.pdf --output-dir images/
document-tools extract-images source.docx --output-dir images/
```

## Fitur Phase 2 yang sudah aktif

### Konversi
- PDF → DOCX (via `pdf2docx`)
- DOCX → PDF (via LibreOffice headless)
- PDF → Image PNG/JPG per halaman (via `pymupdf`)
- Image(s) → PDF (via `Pillow`)
- PDF → Markdown (via `pymupdf`, best-effort)
- DOCX → Markdown (via `mammoth`)
- PDF → Excel / ekstrak tabel (via `pymupdf`, best-effort)
- Excel → PDF (via LibreOffice headless)

### Ekstraksi
- Extract Text dari PDF (via `pymupdf`)
- Extract Text dari DOCX (via `python-docx`)
- Extract Images dari PDF (via `pymupdf`)
- Extract Images dari DOCX (via `python-docx`)

## Install Phase 2 & 3

```sh
pip install -e '.[phase1,phase2,phase3,dev]'
```

---

## Phase 3 — Desktop GUI & Executable Packaging

Aplikasi desktop GUI modern dibangun menggunakan **CustomTkinter** untuk kenyamanan drag-and-drop dan visualisasi menu, serta **PyInstaller** untuk pembungkusan (packaging) menjadi executable standalone.

### Persyaratan Tambahan (System Dependency)
Pada sistem berbasis Debian/Ubuntu Linux, instalasi `python3-tk` diperlukan:
```sh
sudo apt install python3-tk
```

### Menjalankan GUI
Jika aplikasi dijalankan tanpa argumen apa pun, ia akan mendeteksi fallback dan meluncurkan GUI secara otomatis:
```sh
python -m document_tools
# atau
document-tools gui
```

### Membundel ke Executable (.exe / Binary)
Untuk membuat executable mandiri, jalankan PyInstaller menggunakan spec file yang telah disediakan di root repository:
```sh
pyinstaller --noconfirm document_tools.spec
```
Hasil build akan tersimpan di dalam direktori `dist/document_tools/`.

> [!TIP]
> **Packaging untuk Windows**: Karena UI toolkit Tkinter memuat library sistem operasi tujuan, untuk membuat `.exe` Windows disarankan untuk mengunduh/menduplikasi source code ini ke mesin bersistem Windows, menginstal Python & dependencies, lalu menjalankan perintah PyInstaller di atas secara langsung di Windows.

