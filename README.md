# DocuCraft — Privacy-First Document & Image Studio

[![Live Web App](https://img.shields.io/badge/Live%20Demo-toolsdoc.vercel.app-emerald?style=for-the-badge&logo=vercel)](https://toolsdoc.vercel.app/)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg?style=for-the-badge)](LICENSE)
[![Creator](https://img.shields.io/badge/Creator-Taufiqu-zinc.svg?style=for-the-badge&logo=googlechrome)](https://taufiqu.vercel.app/)
[![Client-Side Processing](https://img.shields.io/badge/Privacy-100%25%20In--Memory-purple?style=for-the-badge)](https://toolsdoc.vercel.app/)

**DocuCraft** is an open-source, privacy-first document and image suite designed to execute **100% locally in browser memory (RAM)**. No files are ever uploaded to any third-party server or cloud database.

---

## 🌐 Live Web Application

Experience the studio live in your browser:
👉 **[https://toolsdoc.vercel.app/](https://toolsdoc.vercel.app/)**

---

## ✨ Key Architectural Highlights

- **🔒 100% Client-Side & Zero-Telemetry:** All file transformations (PDF merging, splitting, rasterization, page numbering, compression) run in browser RAM via WebAssembly and HTML5 Canvas.
- **⚡ Works Offline:** Once loaded, the web app functions completely without internet connection.
- **📂 Recursive Folder Upload:** Drag-and-drop entire folders from your computer with recursive subfolder scanning and **natural alphanumeric sorting** (`1.pdf`, `2.pdf`, `10.pdf`).
- **☁️ Google Drive In-Memory Stream:** Import files or entire folders directly from Google Drive using Google Picker API or public sharing links, streamed directly to client RAM.
- **🎨 Editorial Minimalist Interface:** Built with a clean, distraction-free architectural design system tailored for productivity.

---

## 🛠️ Active Modules (14 Studio Tools)

| Category | Module | Capabilities |
| :--- | :--- | :--- |
| **PDF** | **Page Organizer** | Visual drag-and-drop page reordering, 90°/180°/270° rotation, and deletion. |
| **PDF** | **PDF Merger** | Concatenate multiple PDFs or entire folders with standardized paper formats (A4, F4, Letter). |
| **PDF** | **PDF Splitter** | Extract individual pages or split by custom page intervals (e.g. `1-3, 5-8`). |
| **PDF** | **PDF Compressor** | Reduce PDF weights in RAM with *Extreme*, *Recommended*, and *Mild* presets. |
| **PDF** | **Page Numbering** | Add header & footer page indices with custom templates, offsets, and cover skip. |
| **PDF** | **Grayscale & B&W** | Convert color PDFs to crisp monochrome documents to clean scan shadows and save ink. |
| **PDF** | **PDF Watermark** | Stamp diagonal semi-transparent text with customizable opacity, rotation, and size. |
| **PDF** | **PDF to Word** | Reconstruct PDF layouts into editable DOCX files in browser RAM (tables, headings, font styles). |
| **Photo** | **Pas Foto Studio** | Official ID presets (**2×3, 3×4, 4×6, Paspor**) @ 300 DPI with Red/Blue background replacement. |
| **Images** | **PNG to JPG** | Batch convert PNGs to high-quality JPG with custom solid background fills. |
| **Images** | **PDF to Images** | Rasterize PDF pages into high-resolution PNG, JPG, or WebP formats. |
| **Images** | **Images to PDF** | Compile JPG, PNG, and WebP images into a standardized multi-page PDF. |
| **Images** | **Image Compressor** | Multi-file client-side image compression with quality, dimension, and size targets. |
| **Web** | **Favicon Pack** | Generate multi-resolution `.ico` binaries and complete PWA web icon packages. |

---

## 🚀 Quick Start (Web SPA)

### Prerequisites
- Node.js 18+
- npm or pnpm

### Running Locally
```sh
# 1. Clone repository
git clone https://github.com/Taufiqu/document-tools.git
cd document-tools/web

# 2. Install dependencies
npm install

# 3. Start development server
npm run dev
```
Open `http://localhost:5173` in your browser.

### Building for Production
```sh
npm run build
```
The optimized static bundle will be built into `web/dist/`, ready for zero-config deployment on Vercel, Netlify, or GitHub Pages.

---

## 🐍 Python CLI Engine

DocuCraft also contains an autonomous Python CLI engine for headless scripting, automated document pipelines, and batch terminal processing.

Detailed instructions, conversion scripts, and CLI commands are documented in:
📖 **[docs/CLI_REFERENCE.md](docs/CLI_REFERENCE.md)**

---

## 👤 Author & Creator

Designed and engineered by **Taufiqu**:
- 🌐 **Portfolio:** [https://taufiqu.vercel.app/](https://taufiqu.vercel.app/)
- 🐙 **GitHub:** [@Taufiqu](https://github.com/Taufiqu)
- 💼 **Website:** [toolsdoc.vercel.app](https://toolsdoc.vercel.app/)

---

## 📄 License

This project is open-source and licensed under the **[MIT License](LICENSE)**.

Copyright © 2026 **Taufiqu**. All rights reserved.
