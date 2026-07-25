"""
Tests for ConvertService (all conversion routes).

Design notes:
- Tests that require LibreOffice (DOCX↔PDF, XLSX→PDF) are skipped gracefully
  when libreoffice/soffice binary is not found in PATH.
- pdf2docx tests verify the output file is created and is a valid DOCX.
- PDF→Image tests verify one PNG/JPG is created per page.
- Image→PDF tests verify a valid PDF is produced.
- PDF/DOCX→Markdown tests verify output is non-empty UTF-8 text.
- PDF→XLSX tests verify an xlsx file is created (table count may be 0).
"""
from __future__ import annotations

import shutil
from pathlib import Path

import pytest

fitz = pytest.importorskip("fitz", reason="pymupdf not installed")
docx_module = pytest.importorskip("docx", reason="python-docx not installed")
mammoth = pytest.importorskip("mammoth", reason="mammoth not installed")
openpyxl = pytest.importorskip("openpyxl", reason="openpyxl not installed")

from document_tools.exceptions import UnsupportedFormatError, ValidationError
from document_tools.features.convert import (
    ConvertOptions,
    ConvertService,
    ImagesToPdfOptions,
    PdfToImagesOptions,
)
from document_tools.models import DocumentInput, OutputFormat


# ------------------------------------------------------------------ #
# Fixture helpers                                                       #
# ------------------------------------------------------------------ #

LIBREOFFICE_AVAILABLE = shutil.which("libreoffice") is not None or shutil.which("soffice") is not None
needs_libreoffice = pytest.mark.skipif(
    not LIBREOFFICE_AVAILABLE,
    reason="LibreOffice not available in PATH",
)

PDF2DOCX_AVAILABLE = True
try:
    import pdf2docx  # noqa: F401
except ImportError:
    PDF2DOCX_AVAILABLE = False

needs_pdf2docx = pytest.mark.skipif(not PDF2DOCX_AVAILABLE, reason="pdf2docx not installed")


def _create_text_pdf(path: Path, pages: list[str]) -> None:
    """Create a PDF with real text content using reportlab."""
    reportlab = pytest.importorskip("reportlab.pdfgen.canvas")
    canvas = reportlab.Canvas(str(path))
    for text in pages:
        canvas.drawString(72, 720, text)
        canvas.showPage()
    canvas.save()


def _create_blank_pdf(path: Path, page_count: int = 2) -> None:
    pypdf = pytest.importorskip("pypdf")
    writer = pypdf.PdfWriter()
    for _ in range(page_count):
        writer.add_blank_page(width=300, height=300)
    with path.open("wb") as f:
        writer.write(f)


def _create_simple_docx(path: Path, text: str = "Hello world") -> None:
    doc = docx_module.Document()
    doc.add_paragraph(text)
    doc.save(str(path))


def _create_simple_png(path: Path, size: tuple[int, int] = (100, 100)) -> None:
    pil = pytest.importorskip("PIL.Image")
    img = pil.new("RGB", size, color=(128, 200, 100))
    img.save(str(path), format="PNG")


def _create_simple_xlsx(path: Path) -> None:
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.append(["Name", "Value"])
    ws.append(["Alpha", 1])
    ws.append(["Beta", 2])
    wb.save(str(path))


# ------------------------------------------------------------------ #
# PDF → Image                                                           #
# ------------------------------------------------------------------ #


def test_pdf_to_images_png_creates_one_file_per_page(tmp_path: Path) -> None:
    source = tmp_path / "source.pdf"
    output_dir = tmp_path / "images"
    output_dir.mkdir()
    _create_blank_pdf(source, page_count=3)

    service = ConvertService()
    result = service.pdf_to_images(PdfToImagesOptions(
        source=DocumentInput.from_path(source),
        output_dir=output_dir,
        image_format="png",
        dpi=72,
    ))

    assert result.success is True
    assert len(result.output_files) == 3
    assert all(p.suffix == ".png" for p in result.output_files)
    assert all(p.exists() for p in result.output_files)
    assert result.metadata["page_count"] == 3
    assert result.metadata["format"] == "png"


def test_pdf_to_images_jpg_format(tmp_path: Path) -> None:
    source = tmp_path / "source.pdf"
    output_dir = tmp_path / "images"
    output_dir.mkdir()
    _create_blank_pdf(source, page_count=1)

    service = ConvertService()
    result = service.pdf_to_images(PdfToImagesOptions(
        source=DocumentInput.from_path(source),
        output_dir=output_dir,
        image_format="jpg",
        dpi=72,
    ))

    assert result.success is True
    assert result.output_files[0].suffix == ".jpg"


def test_pdf_to_images_rejects_missing_output_dir(tmp_path: Path) -> None:
    source = tmp_path / "source.pdf"
    _create_blank_pdf(source)

    service = ConvertService()
    with pytest.raises(ValidationError):
        service.pdf_to_images(PdfToImagesOptions(
            source=DocumentInput.from_path(source),
            output_dir=tmp_path / "nonexistent",
        ))


def test_pdf_to_images_invalid_dpi_raises(tmp_path: Path) -> None:
    source = tmp_path / "source.pdf"
    _create_blank_pdf(source)
    with pytest.raises(ValidationError):
        PdfToImagesOptions(
            source=DocumentInput.from_path(source),
            output_dir=tmp_path,
            dpi=9999,
        )


# ------------------------------------------------------------------ #
# Image → PDF                                                           #
# ------------------------------------------------------------------ #


def test_images_to_pdf_single_image(tmp_path: Path) -> None:
    img = tmp_path / "image.png"
    output = tmp_path / "output.pdf"
    _create_simple_png(img)

    service = ConvertService()
    result = service.images_to_pdf(ImagesToPdfOptions(
        sources=[DocumentInput.from_path(img)],
        output_path=output,
    ))

    assert result.success is True
    assert output.exists()
    assert result.metadata["image_count"] == 1


def test_images_to_pdf_multiple_images(tmp_path: Path) -> None:
    imgs = [tmp_path / f"img{i}.png" for i in range(3)]
    for img in imgs:
        _create_simple_png(img)
    output = tmp_path / "combined.pdf"

    service = ConvertService()
    result = service.images_to_pdf(ImagesToPdfOptions(
        sources=[DocumentInput.from_path(img) for img in imgs],
        output_path=output,
    ))

    assert result.success is True
    assert output.exists()
    assert result.metadata["image_count"] == 3


def test_images_to_pdf_rejects_empty_sources(tmp_path: Path) -> None:
    service = ConvertService()
    with pytest.raises(ValidationError):
        service.images_to_pdf(ImagesToPdfOptions(
            sources=[],
            output_path=tmp_path / "out.pdf",
        ))


# ------------------------------------------------------------------ #
# PDF → Markdown                                                        #
# ------------------------------------------------------------------ #


def test_pdf_to_markdown_creates_output_file(tmp_path: Path) -> None:
    source = tmp_path / "source.pdf"
    output = tmp_path / "output.md"
    _create_text_pdf(source, ["Hello Markdown World"])

    service = ConvertService()
    result = service.convert(ConvertOptions(
        source=DocumentInput.from_path(source),
        output_path=output,
        output_format=OutputFormat.MARKDOWN,
    ))

    assert result.success is True
    assert output.exists()
    content = output.read_text(encoding="utf-8")
    assert len(content) > 0
    assert result.metadata["output_format"] == "markdown"


def test_pdf_to_markdown_contains_page_headers(tmp_path: Path) -> None:
    source = tmp_path / "source.pdf"
    output = tmp_path / "output.md"
    _create_text_pdf(source, ["Page one text", "Page two text"])

    service = ConvertService()
    service.convert(ConvertOptions(
        source=DocumentInput.from_path(source),
        output_path=output,
        output_format=OutputFormat.MARKDOWN,
    ))

    content = output.read_text(encoding="utf-8")
    assert "## Page 1" in content


# ------------------------------------------------------------------ #
# DOCX → Markdown                                                       #
# ------------------------------------------------------------------ #


def test_docx_to_markdown_creates_output_file(tmp_path: Path) -> None:
    source = tmp_path / "source.docx"
    output = tmp_path / "output.md"
    _create_simple_docx(source, text="Hello from DOCX")

    service = ConvertService()
    result = service.convert(ConvertOptions(
        source=DocumentInput.from_path(source),
        output_path=output,
        output_format=OutputFormat.MARKDOWN,
    ))

    assert result.success is True
    assert output.exists()
    content = output.read_text(encoding="utf-8")
    assert "Hello from DOCX" in content
    assert result.metadata["output_format"] == "markdown"


# ------------------------------------------------------------------ #
# PDF → XLSX (best-effort)                                              #
# ------------------------------------------------------------------ #


def test_pdf_to_xlsx_creates_workbook(tmp_path: Path) -> None:
    source = tmp_path / "source.pdf"
    output = tmp_path / "output.xlsx"
    _create_blank_pdf(source, page_count=1)

    service = ConvertService()
    result = service.convert(ConvertOptions(
        source=DocumentInput.from_path(source),
        output_path=output,
        output_format=OutputFormat.XLSX,
    ))

    assert result.success is True
    assert output.exists()
    assert result.metadata["best_effort"] is True
    # Verify it's a readable XLSX
    wb = openpyxl.load_workbook(str(output))
    assert len(wb.sheetnames) >= 1


# ------------------------------------------------------------------ #
# DOCX → PDF (LibreOffice)                                              #
# ------------------------------------------------------------------ #


@needs_libreoffice
def test_docx_to_pdf_creates_pdf(tmp_path: Path) -> None:
    source = tmp_path / "source.docx"
    output = tmp_path / "output.pdf"
    _create_simple_docx(source)

    service = ConvertService()
    result = service.convert(ConvertOptions(
        source=DocumentInput.from_path(source),
        output_path=output,
        output_format=OutputFormat.PDF,
    ))

    assert result.success is True
    assert output.exists()
    assert output.stat().st_size > 0


# ------------------------------------------------------------------ #
# XLSX → PDF (LibreOffice)                                              #
# ------------------------------------------------------------------ #


@needs_libreoffice
def test_xlsx_to_pdf_creates_pdf(tmp_path: Path) -> None:
    source = tmp_path / "source.xlsx"
    output = tmp_path / "output.pdf"
    _create_simple_xlsx(source)

    service = ConvertService()
    result = service.convert(ConvertOptions(
        source=DocumentInput.from_path(source),
        output_path=output,
        output_format=OutputFormat.PDF,
    ))

    assert result.success is True
    assert output.exists()
    assert output.stat().st_size > 0


# ------------------------------------------------------------------ #
# PDF → DOCX (pdf2docx)                                                 #
# ------------------------------------------------------------------ #


@needs_pdf2docx
def test_pdf_to_docx_creates_docx(tmp_path: Path) -> None:
    source = tmp_path / "source.pdf"
    output = tmp_path / "output.docx"
    _create_text_pdf(source, ["Hello PDF to DOCX"])

    service = ConvertService()
    result = service.convert(ConvertOptions(
        source=DocumentInput.from_path(source),
        output_path=output,
        output_format=OutputFormat.DOCX,
    ))

    assert result.success is True
    assert output.exists()
    assert output.stat().st_size > 0


# ------------------------------------------------------------------ #
# Unsupported route                                                     #
# ------------------------------------------------------------------ #


def test_convert_raises_for_unsupported_route(tmp_path: Path) -> None:
    source = tmp_path / "source.pdf"
    _create_blank_pdf(source)

    service = ConvertService()
    with pytest.raises(UnsupportedFormatError):
        service.convert(ConvertOptions(
            source=DocumentInput.from_path(source),
            output_path=tmp_path / "output.txt",
            output_format=OutputFormat.TEXT,
        ))
