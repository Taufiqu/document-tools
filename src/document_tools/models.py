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
    WEBP = "webp"
    TIFF = "tiff"
    ICO = "ico"
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
            "webp": DocumentType.IMAGE,
            "tiff": DocumentType.IMAGE,
            "tif": DocumentType.IMAGE,
            "ico": DocumentType.IMAGE,
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


@dataclass(slots=True, frozen=True)
class CompressPdfOptions:
    source: DocumentInput
    output_path: Path
    mode: str = "smart"  # "smart" (stream optimizer) or "rasterize"
    quality: int = 60    # 10 - 100
    dpi: int = 150       # 72 - 600 (used in rasterize mode)

    def __post_init__(self) -> None:
        if self.mode not in {"smart", "rasterize"}:
            raise ValidationError("Compress mode must be 'smart' or 'rasterize'")
        if not 1 <= self.quality <= 100:
            raise ValidationError("Compress quality must be between 1 and 100")
        if not 72 <= self.dpi <= 600:
            raise ValidationError("Compress dpi must be between 72 and 600")


@dataclass(slots=True, frozen=True)
class FaviconOptions:
    source: DocumentInput
    output_dir: Path
    sizes: list[int] | None = None
    web_pack: bool = False
    generate_html: bool = False


@dataclass(slots=True)
class OperationResult:
    success: bool
    output_files: list[Path] = field(default_factory=list)
    message: str = ""
    metadata: dict[str, str | int | float | bool | list[str] | list[int]] = field(default_factory=dict)
