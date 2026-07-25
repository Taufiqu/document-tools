from pathlib import Path

import pytest

from document_tools.exceptions import ValidationError
from document_tools.models import DocumentInput, DocumentType, PageRange


def test_document_input_detects_pdf_type() -> None:
    document = DocumentInput.from_path("sample.pdf")

    assert document.path == Path("sample.pdf")
    assert document.document_type == DocumentType.PDF


def test_document_input_rejects_unknown_extension() -> None:
    with pytest.raises(ValidationError):
        DocumentInput.from_path("sample.unknown")


def test_page_range_expands_inclusive_bounds() -> None:
    page_range = PageRange(start=3, end=5)

    assert page_range.expand() == [3, 4, 5]
    assert page_range.to_zero_based() == [2, 3, 4]


def test_page_range_rejects_invalid_bounds() -> None:
    with pytest.raises(ValidationError):
        PageRange(start=0, end=2)

    with pytest.raises(ValidationError):
        PageRange(start=4, end=3)
