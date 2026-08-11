from __future__ import annotations

import importlib
import shutil
import subprocess
import tempfile
from dataclasses import dataclass, field
from io import BytesIO
from pathlib import Path
from typing import Any

from document_tools.exceptions import ProcessingError, UnsupportedFormatError, ValidationError
from document_tools.models import DocumentInput, DocumentType, FaviconOptions, OperationResult, OutputFormat


@dataclass(slots=True, frozen=True)
class ConvertOptions:
    source: DocumentInput
    output_path: Path
    output_format: OutputFormat


@dataclass(slots=True, frozen=True)
class PdfToImagesOptions:
    source: DocumentInput
    output_dir: Path
    image_format: str = "png"
    dpi: int = 150

    def __post_init__(self) -> None:
        if self.image_format.lower() not in {"png", "jpg", "jpeg", "webp", "tiff", "tif"}:
            raise ValidationError("image_format must be one of: png, jpg, jpeg, webp, tiff, tif")
        if self.dpi < 72 or self.dpi > 600:
            raise ValidationError("dpi must be between 72 and 600")


@dataclass(slots=True, frozen=True)
class ImagesToPdfOptions:
    sources: list[DocumentInput]
    output_path: Path


class ConvertService:
    """
    Handles all document format conversion operations.

    Routes:
      PDF  → DOCX   (pdf2docx)
      DOCX → PDF    (LibreOffice headless)
      PDF  → Image  (pymupdf/Pillow, PNG/JPG/WEBP/TIFF per page)
      Image→ PDF    (Pillow)
      Image→ Favicon(Pillow, ICO & Web Favicon Pack)
      PDF  → MD     (pymupdf, best-effort text extraction)
      DOCX → MD     (mammoth)
      PDF  → XLSX   (pymupdf table extraction, best-effort)
      XLSX → PDF    (LibreOffice headless)
    """

    # ------------------------------------------------------------------ #
    # Public API                                                           #
    # ------------------------------------------------------------------ #

    def convert(self, options: ConvertOptions) -> OperationResult:
        """Dispatch a single-file conversion based on source type and output format."""
        self._validate_source(options.source)
        self._validate_output_dir(options.output_path)

        src_type = options.source.document_type
        out_fmt = options.output_format

        if src_type == DocumentType.PDF and out_fmt == OutputFormat.DOCX:
            return self._pdf_to_docx(options)

        if src_type == DocumentType.DOCX and out_fmt == OutputFormat.PDF:
            return self._docx_to_pdf(options)

        if src_type == DocumentType.PDF and out_fmt == OutputFormat.MARKDOWN:
            return self._pdf_to_markdown(options)

        if src_type == DocumentType.DOCX and out_fmt == OutputFormat.MARKDOWN:
            return self._docx_to_markdown(options)

        if src_type == DocumentType.PDF and out_fmt == OutputFormat.XLSX:
            return self._pdf_to_excel(options)

        if src_type == DocumentType.XLSX and out_fmt == OutputFormat.PDF:
            return self._excel_to_pdf(options)

        raise UnsupportedFormatError(
            f"Unsupported conversion: {src_type.value} → {out_fmt.value}"
        )

    def pdf_to_images(self, options: PdfToImagesOptions) -> OperationResult:
        """Convert each PDF page to an image file (PNG, JPG, WEBP, or TIFF)."""
        self._validate_source(options.source)
        if not options.output_dir.exists():
            options.output_dir.mkdir(parents=True, exist_ok=True)
        if options.source.document_type != DocumentType.PDF:
            raise ValidationError("pdf_to_images only accepts PDF sources")

        fitz = self._load_pymupdf()
        pil_image = self._load_pillow()
        stem = options.source.path.stem
        output_files: list[Path] = []
        fmt = options.image_format.lower()

        if fmt in {"jpg", "jpeg"}:
            fitz_fmt = "jpeg"
            file_ext = "jpg"
        elif fmt in {"tiff", "tif"}:
            fitz_fmt = "tiff"
            file_ext = "tiff"
        elif fmt == "webp":
            fitz_fmt = "webp"
            file_ext = "webp"
        else:
            fitz_fmt = "png"
            file_ext = "png"

        try:
            doc = fitz.open(str(options.source.path))
            zoom = options.dpi / 72.0
            matrix = fitz.Matrix(zoom, zoom)

            for page_index, page in enumerate(doc, start=1):
                pixmap = page.get_pixmap(matrix=matrix)
                output_path = options.output_dir / f"{stem}_page_{page_index:04d}.{file_ext}"

                if fitz_fmt == "webp":
                    # Convert via Pillow for clean WebP compression
                    png_bytes = pixmap.tobytes("png")
                    with pil_image.open(BytesIO(png_bytes)) as pil_img:
                        pil_img.save(str(output_path), format="WEBP", quality=90)
                else:
                    pixmap.save(str(output_path), output=fitz_fmt)

                output_files.append(output_path)

            doc.close()
        except ValidationError:
            raise
        except Exception as exc:
            raise ProcessingError(f"Failed to convert PDF to images: {options.source.path}") from exc

        return OperationResult(
            success=True,
            output_files=output_files,
            message=f"Converted {options.source.path.name} to {len(output_files)} image(s)",
            metadata={
                "page_count": len(output_files),
                "format": file_ext,
                "dpi": options.dpi,
            },
        )

    def images_to_pdf(self, options: ImagesToPdfOptions) -> OperationResult:
        """Combine one or more image files into a single PDF."""
        if not options.sources:
            raise ValidationError("images_to_pdf requires at least one image source")

        for item in options.sources:
            if item.document_type != DocumentType.IMAGE:
                raise ValidationError(
                    f"images_to_pdf only accepts IMAGE sources, got: {item.path.name}"
                )
            if not item.path.exists():
                raise ValidationError(f"Source file does not exist: {item.path}")

        self._validate_output_dir(options.output_path)

        pil_image = self._load_pillow()

        try:
            images: list[Any] = []
            for item in options.sources:
                img = pil_image.open(item.path).convert("RGB")
                images.append(img)

            if not images:
                raise ProcessingError("No valid images could be opened")

            first_image = images[0]
            rest = images[1:]
            first_image.save(
                options.output_path,
                format="PDF",
                save_all=True,
                append_images=rest,
            )
        except ValidationError:
            raise
        except Exception as exc:
            raise ProcessingError(f"Failed to combine images into PDF: {options.output_path}") from exc

        return OperationResult(
            success=True,
            output_files=[options.output_path],
            message=f"Combined {len(options.sources)} image(s) into {options.output_path.name}",
            metadata={"image_count": len(options.sources)},
        )

    def generate_favicon(self, options: FaviconOptions) -> OperationResult:
        """
        Generate multi-size favicon (.ico) and optional complete Web Favicon Pack.
        """
        self._validate_source(options.source)
        if options.source.document_type != DocumentType.IMAGE:
            raise ValidationError("generate_favicon only accepts IMAGE sources")

        if not options.output_dir.exists():
            options.output_dir.mkdir(parents=True, exist_ok=True)

        pil_image = self._load_pillow()
        created_files: list[Path] = []

        try:
            with pil_image.open(options.source.path) as raw_img:
                img = raw_img.convert("RGBA") if raw_img.mode != "RGBA" else raw_img.copy()

            if options.web_pack:
                web_formats = {
                    "favicon.ico": [(16, 16), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)],
                    "favicon-32x32.png": (32, 32),
                    "favicon-48x48.png": (48, 48),
                    "favicon-64x64.png": (64, 64),
                    "apple-touch-icon.png": (180, 180),
                    "android-chrome-192x192.png": (192, 192),
                    "android-chrome-512x512.png": (512, 512),
                }

                for filename, spec in web_formats.items():
                    out_file = options.output_dir / filename
                    if filename.endswith(".ico"):
                        ico_sizes: list[Any] = []
                        for w, h in spec:
                            resized = img.resize((w, h), pil_image.Resampling.LANCZOS)
                            ico_sizes.append(resized)
                        ico_sizes[0].save(out_file, format="ICO", sizes=spec)
                    else:
                        w, h = spec
                        resized = img.resize((w, h), pil_image.Resampling.LANCZOS)
                        resized.save(out_file, format="PNG", optimize=True)
                    created_files.append(out_file)

                # Generate HTML tag snippet
                html_file = options.output_dir / "favicon_html.txt"
                html_content = (
                    "<!-- Favicon HTML Tags - Paste inside <head> -->\n"
                    '<link rel="icon" type="image/x-icon" href="favicon.ico">\n'
                    '<link rel="icon" type="image/png" sizes="32x32" href="favicon-32x32.png">\n'
                    '<link rel="icon" type="image/png" sizes="48x48" href="favicon-48x48.png">\n'
                    '<link rel="icon" type="image/png" sizes="64x64" href="favicon-64x64.png">\n'
                    '<link rel="apple-touch-icon" sizes="180x180" href="apple-touch-icon.png">\n'
                    '<link rel="icon" type="image/png" sizes="192x192" href="android-chrome-192x192.png">\n'
                    '<link rel="icon" type="image/png" sizes="512x512" href="android-chrome-512x512.png">\n'
                    '<meta name="theme-color" content="#ffffff">\n'
                )
                html_file.write_text(html_content, encoding="utf-8")
                created_files.append(html_file)

            else:
                target_sizes = options.sizes or [16, 32, 48, 64, 128, 256]
                ico_sizes = []
                size_tuples = []
                for s in target_sizes:
                    resized = img.resize((s, s), pil_image.Resampling.LANCZOS)
                    ico_sizes.append(resized)
                    size_tuples.append((s, s))

                ico_file = options.output_dir / f"{options.source.path.stem}.ico"
                ico_sizes[0].save(ico_file, format="ICO", sizes=size_tuples)
                created_files.append(ico_file)

                if options.generate_html:
                    html_file = options.output_dir / "favicon_html.txt"
                    html_content = (
                        "<!-- Favicon HTML Tag -->\n"
                        f'<link rel="icon" type="image/x-icon" href="{ico_file.name}">\n'
                    )
                    html_file.write_text(html_content, encoding="utf-8")
                    created_files.append(html_file)

        except ValidationError:
            raise
        except Exception as exc:
            raise ProcessingError(f"Failed to generate favicon from {options.source.path}") from exc

        return OperationResult(
            success=True,
            output_files=created_files,
            message=f"Generated {len(created_files)} favicon file(s) in {options.output_dir.name}",
            metadata={
                "file_count": len(created_files),
                "web_pack": options.web_pack,
                "output_dir": str(options.output_dir),
            },
        )

    # ------------------------------------------------------------------ #
    # Internal conversion routes                                            #
    # ------------------------------------------------------------------ #

    def _pdf_to_docx(self, options: ConvertOptions) -> OperationResult:
        cv_module = self._load_pdf2docx()

        try:
            cv = cv_module.Converter(str(options.source.path))
            cv.convert(str(options.output_path))
            cv.close()
        except Exception as exc:
            raise ProcessingError(f"Failed to convert PDF to DOCX: {options.source.path}") from exc

        return OperationResult(
            success=True,
            output_files=[options.output_path],
            message=f"Converted {options.source.path.name} → {options.output_path.name}",
            metadata={
                "source_format": "pdf",
                "output_format": "docx",
            },
        )

    def _docx_to_pdf(self, options: ConvertOptions) -> OperationResult:
        office_binary = self._find_office_binary()
        if office_binary is None:
            raise ProcessingError(
                "DOCX to PDF conversion requires LibreOffice or soffice to be installed and available in PATH"
            )

        # LibreOffice outputs to the same directory as the source with a .pdf extension.
        # We use a temp dir and then move the result to the desired output_path.
        with tempfile.TemporaryDirectory(prefix="document-tools-convert-") as tmp_dir_name:
            tmp_dir = Path(tmp_dir_name)
            process = subprocess.run(
                [
                    office_binary,
                    "--headless",
                    "--convert-to",
                    "pdf:writer_pdf_Export",
                    "--outdir",
                    str(tmp_dir),
                    str(options.source.path),
                ],
                capture_output=True,
                text=True,
                check=False,
            )
            if process.returncode != 0:
                stderr = process.stderr.strip() or process.stdout.strip() or "Unknown LibreOffice error"
                raise ProcessingError(f"Failed to convert DOCX to PDF: {stderr}")

            tmp_pdf = tmp_dir / f"{options.source.path.stem}.pdf"
            if not tmp_pdf.exists():
                raise ProcessingError(
                    f"LibreOffice did not produce the expected PDF output: {tmp_pdf}"
                )

            shutil.move(str(tmp_pdf), str(options.output_path))

        return OperationResult(
            success=True,
            output_files=[options.output_path],
            message=f"Converted {options.source.path.name} → {options.output_path.name}",
            metadata={
                "source_format": "docx",
                "output_format": "pdf",
            },
        )

    def _pdf_to_markdown(self, options: ConvertOptions) -> OperationResult:
        fitz = self._load_pymupdf()

        try:
            doc = fitz.open(str(options.source.path))
            md_sections: list[str] = []
            total_pages = len(doc)

            for page_index, page in enumerate(doc, start=1):
                blocks = page.get_text("blocks")
                page_lines: list[str] = []

                for block in blocks:
                    # blocks: (x0, y0, x1, y1, text, block_no, block_type)
                    # block_type 0 = text, 1 = image
                    if block[6] != 0:
                        continue
                    text = block[4].strip()
                    if text:
                        page_lines.append(text)

                if page_lines:
                    header = f"## Page {page_index}"
                    md_sections.append(header + "\n\n" + "\n\n".join(page_lines))

            doc.close()
            markdown_content = "\n\n---\n\n".join(md_sections)
            options.output_path.write_text(markdown_content, encoding="utf-8")
        except ValidationError:
            raise
        except Exception as exc:
            raise ProcessingError(f"Failed to convert PDF to Markdown: {options.source.path}") from exc

        return OperationResult(
            success=True,
            output_files=[options.output_path],
            message=f"Converted {options.source.path.name} → {options.output_path.name}",
            metadata={
                "source_format": "pdf",
                "output_format": "markdown",
                "page_count": total_pages,
                "char_count": len(markdown_content),
            },
        )

    def _docx_to_markdown(self, options: ConvertOptions) -> OperationResult:
        mammoth = self._load_mammoth()

        try:
            with options.source.path.open("rb") as docx_file:
                result = mammoth.convert_to_markdown(docx_file)
            markdown_content = result.value
            options.output_path.write_text(markdown_content, encoding="utf-8")
            warnings = result.messages
        except ValidationError:
            raise
        except Exception as exc:
            raise ProcessingError(f"Failed to convert DOCX to Markdown: {options.source.path}") from exc

        return OperationResult(
            success=True,
            output_files=[options.output_path],
            message=f"Converted {options.source.path.name} → {options.output_path.name}",
            metadata={
                "source_format": "docx",
                "output_format": "markdown",
                "char_count": len(markdown_content),
                "warning_count": len(warnings),
            },
        )

    def _pdf_to_excel(self, options: ConvertOptions) -> OperationResult:
        """
        Best-effort PDF table extraction to Excel.
        Accuracy depends heavily on the structure and quality of the source PDF.
        """
        fitz = self._load_pymupdf()
        openpyxl = self._load_openpyxl()

        try:
            doc = fitz.open(str(options.source.path))
            workbook = openpyxl.Workbook()
            workbook.remove(workbook.active)  # remove default empty sheet
            total_tables = 0

            for page_index, page in enumerate(doc, start=1):
                tables = page.find_tables()
                if not tables or not tables.tables:
                    continue

                for table_index, table in enumerate(tables.tables, start=1):
                    sheet_name = f"p{page_index}_t{table_index}"
                    ws = workbook.create_sheet(title=sheet_name)
                    for row in table.extract():
                        ws.append([cell if cell is not None else "" for cell in row])
                    total_tables += 1

            doc.close()

            if total_tables == 0:
                # No tables found; create an informational sheet
                ws = workbook.create_sheet(title="no_tables_found")
                ws.append(["No tables were detected in this PDF."])
                ws.append(["Note: This feature works best with PDFs that contain native text tables."])

            workbook.save(str(options.output_path))
        except ValidationError:
            raise
        except Exception as exc:
            raise ProcessingError(f"Failed to extract tables from PDF: {options.source.path}") from exc

        return OperationResult(
            success=True,
            output_files=[options.output_path],
            message=f"Extracted {total_tables} table(s) from {options.source.path.name} (best-effort)",
            metadata={
                "source_format": "pdf",
                "output_format": "xlsx",
                "table_count": total_tables,
                "best_effort": True,
            },
        )

    def _excel_to_pdf(self, options: ConvertOptions) -> OperationResult:
        office_binary = self._find_office_binary()
        if office_binary is None:
            raise ProcessingError(
                "Excel to PDF conversion requires LibreOffice or soffice to be installed and available in PATH"
            )

        with tempfile.TemporaryDirectory(prefix="document-tools-convert-") as tmp_dir_name:
            tmp_dir = Path(tmp_dir_name)
            process = subprocess.run(
                [
                    office_binary,
                    "--headless",
                    "--convert-to",
                    "pdf",
                    "--outdir",
                    str(tmp_dir),
                    str(options.source.path),
                ],
                capture_output=True,
                text=True,
                check=False,
            )
            if process.returncode != 0:
                stderr = process.stderr.strip() or process.stdout.strip() or "Unknown LibreOffice error"
                raise ProcessingError(f"Failed to convert Excel to PDF: {stderr}")

            tmp_pdf = tmp_dir / f"{options.source.path.stem}.pdf"
            if not tmp_pdf.exists():
                raise ProcessingError(
                    f"LibreOffice did not produce the expected PDF output: {tmp_pdf}"
                )

            shutil.move(str(tmp_pdf), str(options.output_path))

        return OperationResult(
            success=True,
            output_files=[options.output_path],
            message=f"Converted {options.source.path.name} → {options.output_path.name}",
            metadata={
                "source_format": "xlsx",
                "output_format": "pdf",
            },
        )

    # ------------------------------------------------------------------ #
    # Validation helpers                                                    #
    # ------------------------------------------------------------------ #

    def _validate_source(self, source: DocumentInput) -> None:
        if not source.path.exists():
            raise ValidationError(f"Source file does not exist: {source.path}")
        if not source.path.is_file():
            raise ValidationError(f"Source path is not a file: {source.path}")

    def _validate_output_dir(self, output_path: Path) -> None:
        parent = output_path.parent
        if str(parent) in {"", "."}:
            return
        if not parent.exists():
            raise ValidationError(f"Output directory does not exist: {parent}")

    # ------------------------------------------------------------------ #
    # System helpers                                                        #
    # ------------------------------------------------------------------ #

    def _find_office_binary(self) -> str | None:
        return shutil.which("libreoffice") or shutil.which("soffice")

    # ------------------------------------------------------------------ #
    # Lazy imports                                                          #
    # ------------------------------------------------------------------ #

    def _load_pymupdf(self) -> Any:
        try:
            return importlib.import_module("fitz")
        except ImportError as exc:
            raise ProcessingError("This feature requires the 'pymupdf' package to be installed") from exc

    def _load_pdf2docx(self) -> Any:
        try:
            return importlib.import_module("pdf2docx")
        except ImportError as exc:
            raise ProcessingError(
                "PDF to DOCX conversion requires the 'pdf2docx' package to be installed"
            ) from exc

    def _load_mammoth(self) -> Any:
        try:
            return importlib.import_module("mammoth")
        except ImportError as exc:
            raise ProcessingError(
                "DOCX to Markdown conversion requires the 'mammoth' package to be installed"
            ) from exc

    def _load_openpyxl(self) -> Any:
        try:
            return importlib.import_module("openpyxl")
        except ImportError as exc:
            raise ProcessingError(
                "PDF to Excel conversion requires the 'openpyxl' package to be installed"
            ) from exc

    def _load_pillow(self) -> Any:
        try:
            return importlib.import_module("PIL.Image")
        except ImportError as exc:
            raise ProcessingError(
                "Image to PDF conversion requires the 'Pillow' package to be installed"
            ) from exc
