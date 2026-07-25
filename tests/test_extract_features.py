"""
Tests for ExtractService (extract_text and extract_images).

Strategy:
- PDF tests use pypdf to build minimal in-memory PDFs with reportlab for text content.
- DOCX tests use python-docx to build minimal documents in-memory.
- We verify outputs exist and contain sensible content; we do not assert exact
  text strings because rendering engines may add spacing/newlines.
"""
from __future__ import annotations

from pathlib import Path

import pytest

fitz = pytest.importorskip("fitz", reason="pymupdf not installed")
docx_module = pytest.importorskip("docx", reason="python-docx not installed")

from document_tools.exceptions import ValidationError
from document_tools.features.extract import ExtractImagesOptions, ExtractService, ExtractTextOptions
from document_tools.models import DocumentInput


# ------------------------------------------------------------------ #
# Fixture helpers                                                       #
# ------------------------------------------------------------------ #


def _create_text_pdf(path: Path, pages: list[str]) -> None:
    """Create a PDF with real text content using reportlab."""
    reportlab = pytest.importorskip("reportlab.pdfgen.canvas")
    canvas = reportlab.Canvas(str(path))
    for page_text in pages:
        canvas.drawString(72, 720, page_text)
        canvas.showPage()
    canvas.save()


def _create_blank_pdf(path: Path, page_count: int = 2) -> None:
    """Create a blank PDF (no text) using pypdf."""
    pypdf = pytest.importorskip("pypdf")
    writer = pypdf.PdfWriter()
    for _ in range(page_count):
        writer.add_blank_page(width=300, height=300)
    with path.open("wb") as f:
        writer.write(f)


def _create_text_docx(path: Path, paragraphs: list[str]) -> None:
    """Create a DOCX with given paragraph texts."""
    doc = docx_module.Document()
    for para in paragraphs:
        doc.add_paragraph(para)
    doc.save(str(path))


# ------------------------------------------------------------------ #
# extract_text — PDF                                                    #
# ------------------------------------------------------------------ #


def test_extract_text_pdf_creates_output_file(tmp_path: Path) -> None:
    source = tmp_path / "source.pdf"
    output = tmp_path / "output.txt"
    _create_text_pdf(source, ["Hello from page one", "Hello from page two"])

    service = ExtractService()
    result = service.extract_text(ExtractTextOptions(
        source=DocumentInput.from_path(source),
        output_path=output,
    ))

    assert result.success is True
    assert output.exists()
    assert result.output_files == [output]
    assert result.metadata["source_format"] == "pdf"


def test_extract_text_pdf_content_is_non_empty(tmp_path: Path) -> None:
    source = tmp_path / "source.pdf"
    output = tmp_path / "output.txt"
    _create_text_pdf(source, ["UNIQUE_MARKER_TEXT"])

    service = ExtractService()
    service.extract_text(ExtractTextOptions(
        source=DocumentInput.from_path(source),
        output_path=output,
    ))

    content = output.read_text(encoding="utf-8")
    assert "UNIQUE_MARKER_TEXT" in content


def test_extract_text_pdf_rejects_missing_source(tmp_path: Path) -> None:
    service = ExtractService()
    with pytest.raises(ValidationError):
        service.extract_text(ExtractTextOptions(
            source=DocumentInput.from_path(tmp_path / "missing.pdf"),
            output_path=tmp_path / "out.txt",
        ))


# ------------------------------------------------------------------ #
# extract_text — DOCX                                                   #
# ------------------------------------------------------------------ #


def test_extract_text_docx_creates_output_file(tmp_path: Path) -> None:
    source = tmp_path / "source.docx"
    output = tmp_path / "output.txt"
    _create_text_docx(source, ["First paragraph", "Second paragraph"])

    service = ExtractService()
    result = service.extract_text(ExtractTextOptions(
        source=DocumentInput.from_path(source),
        output_path=output,
    ))

    assert result.success is True
    assert output.exists()
    assert result.metadata["source_format"] == "docx"


def test_extract_text_docx_content_matches_paragraphs(tmp_path: Path) -> None:
    source = tmp_path / "source.docx"
    output = tmp_path / "output.txt"
    _create_text_docx(source, ["Alpha paragraph", "Beta paragraph"])

    service = ExtractService()
    service.extract_text(ExtractTextOptions(
        source=DocumentInput.from_path(source),
        output_path=output,
    ))

    content = output.read_text(encoding="utf-8")
    assert "Alpha paragraph" in content
    assert "Beta paragraph" in content


# ------------------------------------------------------------------ #
# extract_images — PDF                                                  #
# ------------------------------------------------------------------ #


def test_extract_images_pdf_no_images_returns_empty(tmp_path: Path) -> None:
    """A blank PDF has no embedded images; result should be empty list."""
    source = tmp_path / "source.pdf"
    output_dir = tmp_path / "images"
    output_dir.mkdir()
    _create_blank_pdf(source, page_count=2)

    service = ExtractService()
    result = service.extract_images(ExtractImagesOptions(
        source=DocumentInput.from_path(source),
        output_dir=output_dir,
    ))

    assert result.success is True
    assert result.metadata["image_count"] == 0
    assert result.output_files == []


def test_extract_images_pdf_rejects_missing_output_dir(tmp_path: Path) -> None:
    source = tmp_path / "source.pdf"
    _create_blank_pdf(source)

    service = ExtractService()
    with pytest.raises(ValidationError):
        service.extract_images(ExtractImagesOptions(
            source=DocumentInput.from_path(source),
            output_dir=tmp_path / "nonexistent_dir",
        ))


# ------------------------------------------------------------------ #
# extract_images — DOCX                                                 #
# ------------------------------------------------------------------ #


def test_extract_images_docx_no_images_returns_empty(tmp_path: Path) -> None:
    """A plain-text DOCX has no embedded images."""
    source = tmp_path / "source.docx"
    output_dir = tmp_path / "images"
    output_dir.mkdir()
    _create_text_docx(source, ["No images here"])

    service = ExtractService()
    result = service.extract_images(ExtractImagesOptions(
        source=DocumentInput.from_path(source),
        output_dir=output_dir,
    ))

    assert result.success is True
    assert result.metadata["image_count"] == 0


def test_extract_images_docx_rejects_missing_source(tmp_path: Path) -> None:
    service = ExtractService()
    with pytest.raises(ValidationError):
        service.extract_images(ExtractImagesOptions(
            source=DocumentInput.from_path(tmp_path / "missing.docx"),
            output_dir=tmp_path,
        ))
