from pathlib import Path

import pytest

pypdf = pytest.importorskip("pypdf")

from document_tools.exceptions import ValidationError
from document_tools.features.merge import MergeOptions, MergeService
from document_tools.features.pdf_utils import PdfUtilityService, RotateOperation, WatermarkOptions
from document_tools.features.split import SplitMode, SplitOptions, SplitService
from document_tools.models import DocumentInput, OutputFormat, PageRange


PdfReader = pypdf.PdfReader
PdfWriter = pypdf.PdfWriter


def _create_pdf(path: Path, page_count: int, page_widths: list[int] | None = None) -> None:
    writer = PdfWriter()
    widths = page_widths or [300] * page_count

    if len(widths) != page_count:
        raise ValueError("page_widths length must match page_count")

    for width in widths:
        writer.add_blank_page(width=width, height=300)

    with path.open("wb") as file_obj:
        writer.write(file_obj)


def _create_uncompressed_text_pdf(path: Path) -> None:
    reportlab = pytest.importorskip("reportlab.pdfgen.canvas")

    canvas = reportlab.Canvas(str(path), pageCompression=0)
    long_text = "COMPRESS ME " * 200
    for line_index in range(80):
        canvas.drawString(40, 800 - (line_index * 9), long_text)
    canvas.showPage()
    canvas.save()


def test_merge_pdf_combines_pages_in_order(tmp_path: Path) -> None:
    first_pdf = tmp_path / "first.pdf"
    second_pdf = tmp_path / "second.pdf"
    output_pdf = tmp_path / "merged.pdf"

    _create_pdf(first_pdf, page_count=1)
    _create_pdf(second_pdf, page_count=2)

    service = MergeService()
    result = service.merge(
        MergeOptions(
            inputs=[DocumentInput.from_path(first_pdf), DocumentInput.from_path(second_pdf)],
            output_path=output_pdf,
            output_format=OutputFormat.PDF,
        )
    )

    assert result.success is True
    assert result.output_files == [output_pdf]
    assert result.metadata["input_count"] == 2
    assert result.metadata["page_count"] == 3
    assert len(PdfReader(str(output_pdf)).pages) == 3


def test_merge_pdf_rejects_missing_input_file(tmp_path: Path) -> None:
    missing_pdf = tmp_path / "missing.pdf"
    output_pdf = tmp_path / "merged.pdf"

    service = MergeService()

    with pytest.raises(ValidationError):
        service.merge(
            MergeOptions(
                inputs=[DocumentInput.from_path(missing_pdf)],
                output_path=output_pdf,
                output_format=OutputFormat.PDF,
            )
        )


def test_split_pdf_single_pages_creates_one_file_per_page(tmp_path: Path) -> None:
    source_pdf = tmp_path / "source.pdf"
    _create_pdf(source_pdf, page_count=3)

    service = SplitService()
    result = service.split(
        SplitOptions(
            source=DocumentInput.from_path(source_pdf),
            output_dir=tmp_path,
            mode=SplitMode.SINGLE_PAGES,
        )
    )

    assert result.success is True
    assert len(result.output_files) == 3
    assert [path.name for path in result.output_files] == [
        "source_page_0001.pdf",
        "source_page_0002.pdf",
        "source_page_0003.pdf",
    ]
    assert all(len(PdfReader(str(path)).pages) == 1 for path in result.output_files)


def test_split_pdf_page_ranges_creates_expected_outputs(tmp_path: Path) -> None:
    source_pdf = tmp_path / "source.pdf"
    _create_pdf(source_pdf, page_count=5)

    service = SplitService()
    result = service.split(
        SplitOptions(
            source=DocumentInput.from_path(source_pdf),
            output_dir=tmp_path,
            mode=SplitMode.PAGE_RANGES,
            ranges=[PageRange(1, 2), PageRange(4, 5)],
        )
    )

    assert result.success is True
    assert [path.name for path in result.output_files] == [
        "source_pages_0001-0002.pdf",
        "source_pages_0004-0005.pdf",
    ]
    assert [len(PdfReader(str(path)).pages) for path in result.output_files] == [2, 2]


def test_split_pdf_rejects_out_of_bounds_range(tmp_path: Path) -> None:
    source_pdf = tmp_path / "source.pdf"
    _create_pdf(source_pdf, page_count=2)

    service = SplitService()

    with pytest.raises(ValidationError):
        service.split(
            SplitOptions(
                source=DocumentInput.from_path(source_pdf),
                output_dir=tmp_path,
                mode=SplitMode.PAGE_RANGES,
                ranges=[PageRange(1, 3)],
            )
        )


def test_delete_pages_removes_requested_pages(tmp_path: Path) -> None:
    source_pdf = tmp_path / "source.pdf"
    output_pdf = tmp_path / "deleted.pdf"
    _create_pdf(source_pdf, page_count=4, page_widths=[100, 200, 300, 400])

    service = PdfUtilityService()
    result = service.delete_pages(
        source=DocumentInput.from_path(source_pdf),
        output_path=output_pdf,
        page_indexes=[2, 4],
    )

    reader = PdfReader(str(output_pdf))
    widths = [int(page.mediabox.width) for page in reader.pages]

    assert result.success is True
    assert result.metadata["deleted_pages"] == [2, 4]
    assert result.metadata["remaining_pages"] == 2
    assert widths == [100, 300]


def test_rotate_pages_applies_rotation_to_requested_pages(tmp_path: Path) -> None:
    source_pdf = tmp_path / "source.pdf"
    output_pdf = tmp_path / "rotated.pdf"
    _create_pdf(source_pdf, page_count=3)

    service = PdfUtilityService()
    result = service.rotate_pages(
        source=DocumentInput.from_path(source_pdf),
        output_path=output_pdf,
        operation=RotateOperation(pages=[2, 3], angle=90),
    )

    reader = PdfReader(str(output_pdf))
    rotations = [page.rotation for page in reader.pages]

    assert result.success is True
    assert result.metadata["rotated_pages"] == [2, 3]
    assert result.metadata["angle"] == 90
    assert rotations == [0, 90, 90]


def test_reorder_pages_writes_pages_in_requested_order(tmp_path: Path) -> None:
    source_pdf = tmp_path / "source.pdf"
    output_pdf = tmp_path / "reordered.pdf"
    _create_pdf(source_pdf, page_count=3, page_widths=[100, 200, 300])

    service = PdfUtilityService()
    result = service.reorder_pages(
        source=DocumentInput.from_path(source_pdf),
        output_path=output_pdf,
        page_order=[3, 1, 2],
    )

    reader = PdfReader(str(output_pdf))
    widths = [int(page.mediabox.width) for page in reader.pages]

    assert result.success is True
    assert result.metadata["page_order"] == [3, 1, 2]
    assert result.metadata["page_count"] == 3
    assert widths == [300, 100, 200]


def test_reorder_pages_rejects_incomplete_page_order(tmp_path: Path) -> None:
    source_pdf = tmp_path / "source.pdf"
    output_pdf = tmp_path / "reordered.pdf"
    _create_pdf(source_pdf, page_count=3)

    service = PdfUtilityService()

    with pytest.raises(ValidationError):
        service.reorder_pages(
            source=DocumentInput.from_path(source_pdf),
            output_path=output_pdf,
            page_order=[1, 3],
        )


def test_compress_pdf_reduces_size_for_uncompressed_input(tmp_path: Path) -> None:
    source_pdf = tmp_path / "source_uncompressed.pdf"
    compressed_pdf = tmp_path / "compressed.pdf"
    _create_uncompressed_text_pdf(source_pdf)

    service = PdfUtilityService()
    result = service.compress_pdf(
        source=DocumentInput.from_path(source_pdf),
        output_path=compressed_pdf,
    )

    assert result.success is True
    assert result.metadata["input_size_bytes"] >= result.metadata["output_size_bytes"]
    assert result.metadata["saved_bytes"] >= 0
    assert compressed_pdf.stat().st_size <= source_pdf.stat().st_size


def test_protect_pdf_encrypts_output(tmp_path: Path) -> None:
    source_pdf = tmp_path / "source.pdf"
    output_pdf = tmp_path / "protected.pdf"
    _create_pdf(source_pdf, page_count=2)

    service = PdfUtilityService()
    result = service.protect_pdf(
        source=DocumentInput.from_path(source_pdf),
        output_path=output_pdf,
        password="secret123",
    )

    reader = PdfReader(str(output_pdf))

    assert result.success is True
    assert result.metadata["page_count"] == 2
    assert result.metadata["encrypted"] is True
    assert reader.is_encrypted is True
    assert reader.decrypt("secret123") != 0
    assert len(reader.pages) == 2


def test_unlock_pdf_removes_encryption(tmp_path: Path) -> None:
    source_pdf = tmp_path / "source.pdf"
    protected_pdf = tmp_path / "protected.pdf"
    unlocked_pdf = tmp_path / "unlocked.pdf"
    _create_pdf(source_pdf, page_count=2, page_widths=[111, 222])

    service = PdfUtilityService()
    service.protect_pdf(
        source=DocumentInput.from_path(source_pdf),
        output_path=protected_pdf,
        password="secret123",
    )

    result = service.unlock_pdf(
        source=DocumentInput.from_path(protected_pdf),
        output_path=unlocked_pdf,
        password="secret123",
    )

    reader = PdfReader(str(unlocked_pdf))
    widths = [int(page.mediabox.width) for page in reader.pages]

    assert result.success is True
    assert result.metadata["page_count"] == 2
    assert result.metadata["encrypted"] is False
    assert reader.is_encrypted is False
    assert widths == [111, 222]


def test_unlock_pdf_rejects_wrong_password(tmp_path: Path) -> None:
    source_pdf = tmp_path / "source.pdf"
    protected_pdf = tmp_path / "protected.pdf"
    unlocked_pdf = tmp_path / "unlocked.pdf"
    _create_pdf(source_pdf, page_count=1)

    service = PdfUtilityService()
    service.protect_pdf(
        source=DocumentInput.from_path(source_pdf),
        output_path=protected_pdf,
        password="secret123",
    )

    with pytest.raises(ValidationError):
        service.unlock_pdf(
            source=DocumentInput.from_path(protected_pdf),
            output_path=unlocked_pdf,
            password="wrong-password",
        )


def test_watermark_pdf_adds_text_to_each_page(tmp_path: Path) -> None:
    source_pdf = tmp_path / "source.pdf"
    watermarked_pdf = tmp_path / "watermarked.pdf"
    _create_pdf(source_pdf, page_count=2)

    service = PdfUtilityService()
    result = service.watermark_pdf(
        source=DocumentInput.from_path(source_pdf),
        output_path=watermarked_pdf,
        options=WatermarkOptions(text="CONFIDENTIAL", opacity=0.2),
    )

    reader = PdfReader(str(watermarked_pdf))
    extracted_text = [page.extract_text() or "" for page in reader.pages]

    assert result.success is True
    assert result.metadata["page_count"] == 2
    assert result.metadata["watermark_text"] == "CONFIDENTIAL"
    assert result.metadata["opacity"] == 0.2
    assert all("CONFIDENTIAL" in text for text in extracted_text)
