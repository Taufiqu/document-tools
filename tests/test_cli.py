import json
import shutil
from pathlib import Path

import pytest

from document_tools.cli import main


def _create_pdf(path: Path, page_count: int) -> None:
    from pypdf import PdfWriter

    writer = PdfWriter()
    for _ in range(page_count):
        writer.add_blank_page(width=300, height=300)

    with path.open("wb") as file_obj:
        writer.write(file_obj)


def _create_docx(path: Path, paragraphs: list[str]) -> None:
    docx = pytest.importorskip("docx")

    document = docx.Document()
    for text in paragraphs:
        document.add_paragraph(text)
    document.save(str(path))


def test_cli_merge_pdf_command_creates_output(tmp_path: Path, capsys) -> None:
    first_pdf = tmp_path / "first.pdf"
    second_pdf = tmp_path / "second.pdf"
    output_pdf = tmp_path / "merged.pdf"
    _create_pdf(first_pdf, 1)
    _create_pdf(second_pdf, 2)

    exit_code = main([
        "merge-pdf",
        str(first_pdf),
        str(second_pdf),
        "--output",
        str(output_pdf),
    ])

    captured = capsys.readouterr()
    payload = json.loads(captured.out)

    assert exit_code == 0
    assert output_pdf.exists()
    assert payload["success"] is True
    assert payload["metadata"]["page_count"] == 3


def test_cli_split_pdf_ranges_command_creates_outputs(tmp_path: Path, capsys) -> None:
    source_pdf = tmp_path / "source.pdf"
    _create_pdf(source_pdf, 5)

    exit_code = main([
        "split-pdf",
        str(source_pdf),
        "--output-dir",
        str(tmp_path),
        "--ranges",
        "1-2,4-5",
    ])

    captured = capsys.readouterr()
    payload = json.loads(captured.out)

    assert exit_code == 0
    assert payload["success"] is True
    assert payload["metadata"]["output_count"] == 2
    assert (tmp_path / "source_pages_0001-0002.pdf").exists()
    assert (tmp_path / "source_pages_0004-0005.pdf").exists()


def test_cli_merge_docx_command_creates_output(tmp_path: Path, capsys) -> None:
    docx = pytest.importorskip("docx")

    first_docx = tmp_path / "first.docx"
    second_docx = tmp_path / "second.docx"
    output_docx = tmp_path / "merged.docx"
    _create_docx(first_docx, ["Alpha"])
    _create_docx(second_docx, ["Beta"])

    exit_code = main([
        "merge-docx",
        str(first_docx),
        str(second_docx),
        "--output",
        str(output_docx),
    ])

    captured = capsys.readouterr()
    payload = json.loads(captured.out)
    merged_document = docx.Document(str(output_docx))
    merged_text = [paragraph.text for paragraph in merged_document.paragraphs if paragraph.text.strip()]

    assert exit_code == 0
    assert output_docx.exists()
    assert payload["success"] is True
    assert payload["metadata"]["input_count"] == 2
    assert merged_text[:2] == ["Alpha", "Beta"]


def test_cli_split_docx_command_creates_outputs(tmp_path: Path, capsys) -> None:
    docx = pytest.importorskip("docx")
    wd_section = pytest.importorskip("docx.enum.section").WD_SECTION

    source_docx = tmp_path / "sections.docx"
    output_dir = tmp_path / "out"
    output_dir.mkdir()

    document = docx.Document()
    document.add_paragraph("Section 1")
    document.add_section(wd_section.NEW_PAGE)
    document.add_paragraph("Section 2")
    document.save(str(source_docx))

    exit_code = main([
        "split-docx",
        str(source_docx),
        "--output-dir",
        str(output_dir),
    ])

    captured = capsys.readouterr()
    payload = json.loads(captured.out)

    first_output = output_dir / "sections_section_0001.docx"
    second_output = output_dir / "sections_section_0002.docx"
    first_text = [paragraph.text for paragraph in docx.Document(str(first_output)).paragraphs if paragraph.text.strip()]
    second_text = [paragraph.text for paragraph in docx.Document(str(second_output)).paragraphs if paragraph.text.strip()]

    assert exit_code == 0
    assert payload["success"] is True
    assert payload["metadata"]["output_count"] == 2
    assert first_output.exists()
    assert second_output.exists()
    assert first_text == ["Section 1"]
    assert second_text == ["Section 2"]


@pytest.mark.skipif(
    shutil.which("libreoffice") is None and shutil.which("soffice") is None,
    reason="LibreOffice is required for mixed DOCX+PDF to PDF conversion",
)
def test_cli_merge_mixed_pdf_command_creates_output(tmp_path: Path, capsys) -> None:
    source_pdf = tmp_path / "first.pdf"
    source_docx = tmp_path / "second.docx"
    output_pdf = tmp_path / "mixed.pdf"
    _create_pdf(source_pdf, 1)
    _create_docx(source_docx, ["Mixed paragraph"])

    exit_code = main([
        "merge-mixed-pdf",
        str(source_pdf),
        str(source_docx),
        "--output",
        str(output_pdf),
    ])

    captured = capsys.readouterr()
    payload = json.loads(captured.out)

    assert exit_code == 0
    assert output_pdf.exists()
    assert payload["success"] is True
    assert payload["metadata"]["converted_docx_count"] == 1


def test_cli_returns_error_code_for_invalid_page_input(tmp_path: Path, capsys) -> None:
    source_pdf = tmp_path / "source.pdf"
    output_pdf = tmp_path / "deleted.pdf"
    _create_pdf(source_pdf, 2)

    exit_code = main([
        "delete-pages",
        str(source_pdf),
        "--output",
        str(output_pdf),
        "--pages",
        "one,two",
    ])

    captured = capsys.readouterr()

    assert exit_code == 1
    assert "Invalid page number" in captured.err
    assert not output_pdf.exists()


def test_cli_watermark_pdf_command_creates_output(tmp_path: Path, capsys) -> None:
    source_pdf = tmp_path / "source.pdf"
    output_pdf = tmp_path / "watermarked.pdf"
    _create_pdf(source_pdf, 1)

    exit_code = main([
        "watermark-pdf",
        str(source_pdf),
        "--output",
        str(output_pdf),
        "--text",
        "CONFIDENTIAL",
        "--opacity",
        "0.2",
    ])

    captured = capsys.readouterr()
    payload = json.loads(captured.out)

    assert exit_code == 0
    assert output_pdf.exists()
    assert payload["success"] is True
    assert payload["metadata"]["watermark_text"] == "CONFIDENTIAL"


def test_cli_compress_pdf_command_creates_output(tmp_path: Path, capsys) -> None:
    source_pdf = tmp_path / "source.pdf"
    output_pdf = tmp_path / "compressed.pdf"
    _create_pdf(source_pdf, 1)

    exit_code = main([
        "compress-pdf",
        str(source_pdf),
        "--output",
        str(output_pdf),
    ])

    captured = capsys.readouterr()
    payload = json.loads(captured.out)

    assert exit_code == 0
    assert output_pdf.exists()
    assert payload["success"] is True
    assert "output_size_bytes" in payload["metadata"]
