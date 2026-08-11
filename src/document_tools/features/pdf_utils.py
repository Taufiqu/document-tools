from __future__ import annotations

import importlib
from dataclasses import dataclass
from io import BytesIO
from pathlib import Path
from typing import Any

from document_tools.exceptions import ProcessingError, ValidationError
from document_tools.models import CompressPdfOptions, DocumentInput, DocumentType, OperationResult


@dataclass(slots=True, frozen=True)
class RotateOperation:
    pages: list[int]
    angle: int

    def __post_init__(self) -> None:
        if self.angle not in {90, 180, 270}:
            raise ValidationError("Rotate angle must be one of: 90, 180, 270")
        if not self.pages:
            raise ValidationError("Rotate operation requires at least one page index")


@dataclass(slots=True, frozen=True)
class WatermarkOptions:
    text: str
    opacity: float = 0.15

    def __post_init__(self) -> None:
        if not self.text.strip():
            raise ValidationError("Watermark text cannot be empty")
        if not 0 < self.opacity <= 1:
            raise ValidationError("Watermark opacity must be between 0 and 1")


class PdfUtilityService:
    def delete_pages(self, source: DocumentInput, output_path: Path, page_indexes: list[int]) -> OperationResult:
        self._validate_pdf_source(source)
        if not page_indexes:
            raise ValidationError("delete_pages requires at least one page number")

        pypdf = self._load_pypdf()

        try:
            reader = pypdf.PdfReader(str(source.path))
            self._unlock_reader_if_needed(reader, source)
            total_pages = len(reader.pages)
            deletion_set = self._normalize_page_numbers(page_indexes, total_pages)

            if len(deletion_set) == total_pages:
                raise ValidationError("delete_pages cannot remove every page from the PDF")

            writer = pypdf.PdfWriter()
            for page_number, page in enumerate(reader.pages, start=1):
                if page_number not in deletion_set:
                    writer.add_page(page)

            self._write_pdf(writer, output_path)
        except ValidationError:
            raise
        except Exception as exc:
            raise ProcessingError(f"Failed to delete pages from PDF: {source.path}") from exc

        return OperationResult(
            success=True,
            output_files=[output_path],
            message=f"Deleted {len(deletion_set)} page(s) from {source.path.name}",
            metadata={
                "deleted_pages": sorted(deletion_set),
                "remaining_pages": total_pages - len(deletion_set),
            },
        )

    def rotate_pages(self, source: DocumentInput, output_path: Path, operation: RotateOperation) -> OperationResult:
        self._validate_pdf_source(source)

        pypdf = self._load_pypdf()

        try:
            reader = pypdf.PdfReader(str(source.path))
            self._unlock_reader_if_needed(reader, source)
            total_pages = len(reader.pages)
            rotation_targets = self._normalize_page_numbers(operation.pages, total_pages)

            writer = pypdf.PdfWriter()
            for page_number, page in enumerate(reader.pages, start=1):
                if page_number in rotation_targets:
                    page.rotate(operation.angle)
                writer.add_page(page)

            self._write_pdf(writer, output_path)
        except ValidationError:
            raise
        except Exception as exc:
            raise ProcessingError(f"Failed to rotate PDF pages: {source.path}") from exc

        return OperationResult(
            success=True,
            output_files=[output_path],
            message=f"Rotated {len(rotation_targets)} page(s) in {source.path.name}",
            metadata={
                "rotated_pages": sorted(rotation_targets),
                "angle": operation.angle,
            },
        )

    def reorder_pages(self, source: DocumentInput, output_path: Path, page_order: list[int]) -> OperationResult:
        self._validate_pdf_source(source)
        if not page_order:
            raise ValidationError("reorder_pages requires a non-empty page order")

        pypdf = self._load_pypdf()

        try:
            reader = pypdf.PdfReader(str(source.path))
            self._unlock_reader_if_needed(reader, source)
            total_pages = len(reader.pages)
            normalized_order = self._validate_full_page_order(page_order, total_pages)

            writer = pypdf.PdfWriter()
            for page_number in normalized_order:
                writer.add_page(reader.pages[page_number - 1])

            self._write_pdf(writer, output_path)
        except ValidationError:
            raise
        except Exception as exc:
            raise ProcessingError(f"Failed to reorder PDF pages: {source.path}") from exc

        return OperationResult(
            success=True,
            output_files=[output_path],
            message=f"Reordered pages in {source.path.name}",
            metadata={
                "page_order": normalized_order,
                "page_count": total_pages,
            },
        )

    def compress_pdf(
        self,
        source: DocumentInput,
        output_path: Path,
        options: CompressPdfOptions | None = None,
    ) -> OperationResult:
        self._validate_pdf_source(source)
        self._validate_output_path(output_path)

        mode = options.mode if options else "smart"
        quality = options.quality if options else 60
        dpi = options.dpi if options else 150

        # Try using PyMuPDF + Pillow for advanced smart / rasterize compression
        fitz = None
        pil_image = None
        try:
            fitz = importlib.import_module("fitz")
            pil_image = importlib.import_module("PIL.Image")
        except ImportError:
            pass

        if fitz is not None and pil_image is not None:
            return self._compress_pdf_pymupdf(source, output_path, mode, quality, dpi, fitz, pil_image)

        # Fallback to pypdf stream deflation
        return self._compress_pdf_pypdf(source, output_path)

    def _compress_pdf_pymupdf(
        self,
        source: DocumentInput,
        output_path: Path,
        mode: str,
        quality: int,
        dpi: int,
        fitz: Any,
        pil_image: Any,
    ) -> OperationResult:
        try:
            doc = fitz.open(str(source.path))
            total_pages = len(doc)
            if total_pages == 0:
                doc.close()
                raise ValidationError("PDF file has no pages")

            optimized_images = 0

            if mode == "smart":
                processed_xrefs = set()
                for page_idx in range(total_pages):
                    page = doc[page_idx]
                    image_list = page.get_images(full=True)

                    for img_info in image_list:
                        xref = img_info[0]
                        if xref in processed_xrefs:
                            continue
                        processed_xrefs.add(xref)

                        try:
                            base_image = doc.extract_image(xref)
                            image_bytes = base_image["image"]
                            img = pil_image.open(BytesIO(image_bytes))

                            if img.mode in ("RGBA", "P", "CMYK"):
                                img = img.convert("RGB")

                            buf = BytesIO()
                            img.save(buf, format="JPEG", quality=quality, optimize=True)
                            compressed_bytes = buf.getvalue()

                            if len(compressed_bytes) < len(image_bytes):
                                doc.update_stream(xref, compressed_bytes)
                                optimized_images += 1
                        except Exception:
                            # Skip uncompressable / problematic individual images
                            pass

                doc.save(
                    str(output_path),
                    garbage=4,
                    deflate=True,
                    deflate_images=True,
                    deflate_fonts=True,
                )
                doc.close()

            else:  # rasterize mode
                output_doc = fitz.open()
                scale = dpi / 72.0
                mat = fitz.Matrix(scale, scale)

                for page_idx in range(total_pages):
                    page = doc[page_idx]
                    pix = page.get_pixmap(matrix=mat)
                    img_data = pix.tobytes("ppm")
                    img = pil_image.open(BytesIO(img_data))
                    if img.mode != "RGB":
                        img = img.convert("RGB")

                    buf = BytesIO()
                    img.save(buf, format="JPEG", quality=quality, optimize=True)
                    compressed_bytes = buf.getvalue()

                    new_page = output_doc.new_page(width=page.rect.width, height=page.rect.height)
                    new_page.insert_image(page.rect, stream=compressed_bytes)
                    optimized_images += 1

                output_doc.save(str(output_path), garbage=4, deflate=True)
                output_doc.close()
                doc.close()

        except ValidationError:
            raise
        except Exception as exc:
            raise ProcessingError(f"Failed to compress PDF via PyMuPDF: {source.path}") from exc

        input_size = source.path.stat().st_size
        output_size = output_path.stat().st_size
        saved_bytes = max(input_size - output_size, 0)
        compression_ratio = round((saved_bytes / input_size), 4) if input_size else 0.0
        reduction_percentage = round((saved_bytes / input_size) * 100, 2) if input_size else 0.0

        return OperationResult(
            success=True,
            output_files=[output_path],
            message=f"Compressed {source.path.name} ({reduction_percentage}% reduction)",
            metadata={
                "page_count": total_pages,
                "mode": mode,
                "quality": quality,
                "dpi": dpi,
                "engine": "pymupdf",
                "optimized_images": optimized_images,
                "input_size_bytes": input_size,
                "output_size_bytes": output_size,
                "saved_bytes": saved_bytes,
                "compression_ratio": compression_ratio,
                "reduction_percentage": reduction_percentage,
            },
        )

    def _compress_pdf_pypdf(self, source: DocumentInput, output_path: Path) -> OperationResult:
        pypdf = self._load_pypdf()

        try:
            reader = pypdf.PdfReader(str(source.path))
            self._unlock_reader_if_needed(reader, source)
            writer = pypdf.PdfWriter()

            for page in reader.pages:
                writer.add_page(page)
                writer.pages[-1].compress_content_streams()

            writer.compress_identical_objects(remove_duplicates=True, remove_unreferenced=True)
            if getattr(reader, "is_encrypted", False) and source.password:
                writer.encrypt(source.password)

            self._write_pdf(writer, output_path)
        except ValidationError:
            raise
        except Exception as exc:
            raise ProcessingError(f"Failed to compress PDF: {source.path}") from exc

        input_size = source.path.stat().st_size
        output_size = output_path.stat().st_size
        saved_bytes = max(input_size - output_size, 0)
        compression_ratio = (saved_bytes / input_size) if input_size else 0.0
        reduction_percentage = round((saved_bytes / input_size) * 100, 2) if input_size else 0.0

        return OperationResult(
            success=True,
            output_files=[output_path],
            message=f"Compressed {source.path.name} ({reduction_percentage}% reduction)",
            metadata={
                "page_count": len(reader.pages),
                "engine": "pypdf",
                "mode": "basic",
                "input_size_bytes": input_size,
                "output_size_bytes": output_size,
                "saved_bytes": saved_bytes,
                "compression_ratio": round(compression_ratio, 4),
                "reduction_percentage": reduction_percentage,
            },
        )

    def protect_pdf(self, source: DocumentInput, output_path: Path, password: str) -> OperationResult:
        self._validate_pdf_source(source)
        if not password:
            raise ValidationError("protect_pdf requires a non-empty password")

        pypdf = self._load_pypdf()

        try:
            reader = pypdf.PdfReader(str(source.path))
            self._unlock_reader_if_needed(reader, source)
            writer = pypdf.PdfWriter()
            self._copy_reader_pages(reader, writer)
            writer.encrypt(password)
            self._write_pdf(writer, output_path)
        except ValidationError:
            raise
        except Exception as exc:
            raise ProcessingError(f"Failed to protect PDF: {source.path}") from exc

        return OperationResult(
            success=True,
            output_files=[output_path],
            message=f"Protected {source.path.name} with a password",
            metadata={
                "page_count": len(reader.pages),
                "encrypted": True,
            },
        )

    def unlock_pdf(self, source: DocumentInput, output_path: Path, password: str) -> OperationResult:
        self._validate_pdf_source(source)
        if not password:
            raise ValidationError("unlock_pdf requires a password")

        pypdf = self._load_pypdf()

        try:
            source_with_password = DocumentInput(
                path=source.path,
                document_type=source.document_type,
                password=password,
            )
            reader = pypdf.PdfReader(str(source.path))
            self._unlock_reader_if_needed(reader, source_with_password)
            writer = pypdf.PdfWriter()
            self._copy_reader_pages(reader, writer)
            self._write_pdf(writer, output_path)
        except ValidationError:
            raise
        except Exception as exc:
            raise ProcessingError(f"Failed to unlock PDF: {source.path}") from exc

        return OperationResult(
            success=True,
            output_files=[output_path],
            message=f"Unlocked {source.path.name}",
            metadata={
                "page_count": len(reader.pages),
                "encrypted": False,
            },
        )

    def watermark_pdf(self, source: DocumentInput, output_path: Path, options: WatermarkOptions) -> OperationResult:
        self._validate_pdf_source(source)

        pypdf = self._load_pypdf()
        reportlab_canvas = self._load_reportlab_canvas()

        try:
            reader = pypdf.PdfReader(str(source.path))
            self._unlock_reader_if_needed(reader, source)
            writer = pypdf.PdfWriter()

            for page in reader.pages:
                watermark_page = self._build_watermark_page(
                    pypdf=pypdf,
                    reportlab_canvas=reportlab_canvas,
                    width=float(page.mediabox.width),
                    height=float(page.mediabox.height),
                    options=options,
                )
                writer.add_page(page)
                writer.pages[-1].merge_page(watermark_page, over=False)

            self._write_pdf(writer, output_path)
        except ValidationError:
            raise
        except Exception as exc:
            raise ProcessingError(f"Failed to apply watermark to PDF: {source.path}") from exc

        return OperationResult(
            success=True,
            output_files=[output_path],
            message=f"Applied watermark to {source.path.name}",
            metadata={
                "page_count": len(reader.pages),
                "watermark_text": options.text,
                "opacity": options.opacity,
            },
        )

    def _validate_pdf_source(self, source: DocumentInput) -> None:
        if source.document_type != DocumentType.PDF:
            raise ValidationError("PDF utility only accepts PDF sources")
        if not source.path.exists():
            raise ValidationError(f"Source file does not exist: {source.path}")
        if not source.path.is_file():
            raise ValidationError(f"Source path is not a file: {source.path}")

    def _validate_output_path(self, output_path: Path) -> None:
        parent = output_path.parent
        if str(parent) not in {"", "."} and not parent.exists():
            raise ValidationError(f"Output directory does not exist: {parent}")

    def _normalize_page_numbers(self, page_numbers: list[int], total_pages: int) -> set[int]:
        normalized = set(page_numbers)
        if len(normalized) != len(page_numbers):
            raise ValidationError("Page numbers must not contain duplicates")

        invalid_pages = sorted(page for page in normalized if page < 1 or page > total_pages)
        if invalid_pages:
            raise ValidationError(
                f"Page numbers out of bounds: {invalid_pages}. Valid range is 1-{total_pages}"
            )

        return normalized

    def _validate_full_page_order(self, page_order: list[int], total_pages: int) -> list[int]:
        if len(page_order) != total_pages:
            raise ValidationError(
                f"Page order must contain exactly {total_pages} entries, got {len(page_order)}"
            )

        expected_pages = set(range(1, total_pages + 1))
        provided_pages = set(page_order)
        if provided_pages != expected_pages:
            raise ValidationError(
                f"Page order must contain each page exactly once in the range 1-{total_pages}"
            )

        return page_order

    def _unlock_reader_if_needed(self, reader: Any, source: DocumentInput) -> None:
        if not getattr(reader, "is_encrypted", False):
            return

        if not source.password:
            raise ValidationError(f"PDF is encrypted but no password was provided: {source.path}")

        decrypt_result = reader.decrypt(source.password)
        if decrypt_result == 0:
            raise ValidationError(f"Failed to decrypt PDF with the supplied password: {source.path}")

    def _copy_reader_pages(self, reader: Any, writer: Any) -> None:
        for page in reader.pages:
            writer.add_page(page)

    def _write_pdf(self, writer: Any, output_path: Path) -> None:
        parent = output_path.parent
        if str(parent) not in {"", "."} and not parent.exists():
            raise ValidationError(f"Output directory does not exist: {parent}")

        with output_path.open("wb") as output_file:
            writer.write(output_file)

    def _build_watermark_page(
        self,
        pypdf: Any,
        reportlab_canvas: Any,
        width: float,
        height: float,
        options: WatermarkOptions,
    ) -> Any:
        buffer = BytesIO()
        canvas = reportlab_canvas.Canvas(buffer, pagesize=(width, height))
        canvas.saveState()
        canvas.setFillGray(0.6)
        if hasattr(canvas, "setFillAlpha"):
            canvas.setFillAlpha(options.opacity)
        canvas.setFont("Helvetica-Bold", min(width, height) * 0.08)
        canvas.translate(width / 2, height / 2)
        canvas.rotate(45)
        canvas.drawCentredString(0, 0, options.text)
        canvas.restoreState()
        canvas.showPage()
        canvas.save()
        buffer.seek(0)

        watermark_reader = pypdf.PdfReader(buffer)
        return watermark_reader.pages[0]

    def _load_pypdf(self) -> Any:
        try:
            return importlib.import_module("pypdf")
        except ImportError as exc:
            raise ProcessingError("PDF utilities require the 'pypdf' package to be installed") from exc

    def _load_reportlab_canvas(self) -> Any:
        try:
            canvas_module = importlib.import_module("reportlab.pdfgen.canvas")
            return canvas_module
        except ImportError as exc:
            raise ProcessingError("PDF watermark requires the 'reportlab' package to be installed") from exc
