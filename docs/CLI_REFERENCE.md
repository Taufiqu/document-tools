# Document Tools — Python CLI & Engine Reference

This document provides a detailed reference for running the local Python CLI engine and development tests.

---

## 🛠️ Setup Local Environment

```sh
python3 -m venv .venv
source .venv/bin/activate  # On Windows: .venv\Scripts\activate
pip install -e '.[phase1,phase2,dev]'
```

## 🧪 Running Unit Tests

```sh
pytest
```

---

## 💻 CLI Commands Reference

Available globally via:
```sh
document-tools --help
```

### 1. PDF Operations

#### Merge PDFs
```sh
document-tools merge-pdf a.pdf b.pdf --output merged.pdf
```

#### Split PDF
```sh
# Split each page into individual files
document-tools split-pdf source.pdf --output-dir out --single-pages

# Split by custom page ranges
document-tools split-pdf source.pdf --output-dir out --ranges 1-2,4-5
```

#### Page Organization
```sh
# Delete pages
document-tools delete-pages source.pdf --output deleted.pdf --pages 2,4

# Rotate pages
document-tools rotate-pages source.pdf --output rotated.pdf --pages 1,3 --angle 90

# Reorder pages
document-tools reorder-pages source.pdf --output reordered.pdf --order 3,1,2
```

#### Compress PDF
```sh
# Smart mode (compresses internal raster streams without altering vector text)
document-tools compress-pdf source.pdf --output compressed.pdf --mode smart --quality 60

# Rasterize mode (converts pages to compressed raster streams)
document-tools compress-pdf source.pdf --output compressed.pdf --mode rasterize --quality 60 --dpi 150
```

#### Security & Watermark
```sh
# Protect with password
document-tools protect-pdf source.pdf --output protected.pdf --password secret123

# Unlock with password
document-tools unlock-pdf protected.pdf --output unlocked.pdf --password secret123

# Diagonal watermark stamp
document-tools watermark-pdf source.pdf --output watermarked.pdf --text CONFIDENTIAL --opacity 0.2
```

---

### 2. Conversions & Extractions

#### PDF / Word / Excel / Markdown
```sh
# PDF to Word (.docx)
document-tools convert-pdf-to-docx source.pdf --output output.docx

# Word (.docx) to PDF
document-tools convert-docx-to-pdf source.docx --output output.pdf

# PDF to Images (per page)
document-tools convert-pdf-to-images source.pdf --output-dir out/ --format png --dpi 150

# Images to PDF
document-tools convert-images-to-pdf img1.png img2.jpg --output combined.pdf

# PDF to Markdown
document-tools convert-pdf-to-md source.pdf --output output.md

# Word to Markdown
document-tools convert-docx-to-md source.docx --output output.md

# PDF to Excel table extraction
document-tools convert-pdf-to-xlsx source.pdf --output output.xlsx

# Excel to PDF
document-tools convert-xlsx-to-pdf source.xlsx --output output.pdf
```

#### Content Extraction
```sh
# Extract text stream
document-tools extract-text source.pdf --output text.txt
document-tools extract-text source.docx --output text.txt

# Extract embedded images
document-tools extract-images source.pdf --output-dir images/
document-tools extract-images source.docx --output-dir images/
```

#### Favicon & Web Icon Generation
```sh
# Multi-resolution .ico
document-tools generate-favicon logo.png -o favicons/

# Complete Web Favicon Pack (apple-touch, android-chrome, favicon.ico, & HTML tags)
document-tools generate-favicon logo.png -o favicons/ --web-pack
```

---

### 3. DOCX & Mixed Formats
```sh
# Merge DOCX
document-tools merge-docx a.docx b.docx --output merged.docx

# Merge mixed PDF + DOCX into PDF (requires LibreOffice headless)
document-tools merge-mixed-pdf a.pdf b.docx c.pdf --output merged.pdf

# Split DOCX per section break
document-tools split-docx source.docx --output-dir out
```
