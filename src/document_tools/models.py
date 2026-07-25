from __future__ import annotations

from dataclasses import dataclass, field
from enum import StrEnum
from pathlib import Path

from .exceptions import ValidationError


class DocumentType(StrEnum):
    PDF = "pdf"
    DOCX = "docx"
    IMAGE = "image"
    XLSX = "xlsx"
    MARKDOWN = "markdown"
    TEXT = "text"


class OutputFormat(StrEnum):
    PDF = "pdf"
    DOCX = "docx"
    XLSX = "xlsx"
    PNG = "png"
    JPG = "jpg"
    MARKDOWN = "markdown"
    TEXT = "text"


@dataclass(slots=True, frozen=True)
class DocumentInput:
    path: Path
    document_type: DocumentType
    password: str | None = None

    @classmethod
    def from_path(cls, path: str | Path, password: str | None = None) -> "DocumentInput":
        resolved = Path(path)
        suffix = resolved.suffix.lower().lstrip(".")

        type_map = {
            "pdf": DocumentType.PDF,
            "docx": DocumentType.DOCX,
            "png": DocumentType.IMAGE,
            "jpg": DocumentType.IMAGE,
            "jpeg": DocumentType.IMAGE,
            "xlsx": DocumentType.XLSX,
            "md": DocumentType.MARKDOWN,
            "txt": DocumentType.TEXT,
        }

        document_type = type_map.get(suffix)
        if document_type is None:
            raise ValidationError(f"Unsupported file extension: .{suffix or 'unknown'}")

        return cls(path=resolved, document_type=document_type, password=password)


@dataclass(slots=True, frozen=True)
class PageRange:
    start: int
    end: int

    def __post_init__(self) -> None:
        if self.start < 1:
            raise ValidationError("PageRange.start must be >= 1")
        if self.end < self.start:
            raise ValidationError("PageRange.end must be >= start")

    def expand(self) -> list[int]:
        return list(range(self.start, self.end + 1))

    def to_zero_based(self) -> list[int]:
        return [page - 1 for page in self.expand()]


@dataclass(slots=True)
class OperationResult:
    success: bool
    output_files: list[Path] = field(default_factory=list)
    message: str = ""
    metadata: dict[str, str | int | float | bool | list[str] | list[int]] = field(default_factory=dict)
