from __future__ import annotations

import importlib
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from document_tools.exceptions import ProcessingError, UnsupportedFormatError, ValidationError
from document_tools.models import DocumentInput, DocumentType, OperationResult


@dataclass(slots=True, frozen=True)
class ExtractTextOptions:
    source: DocumentInput
    output_path: Path


@dataclass(slots=True, frozen=True)
class ExtractImagesOptions:
    source: DocumentInput
    output_dir: Path


class ExtractService:
    # ------------------------------------------------------------------ #
    # Public API                                                           #
    # ------------------------------------------------------------------ #

    def extract_text(self, options: ExtractTextOptions) -> OperationResult:
        """Extract all plain text from a PDF or DOCX into a .txt file."""
        self._validate_source(options.source)
        self._validate_output_path(options.output_path)

        if options.source.document_type == DocumentType.PDF:
            return self._extract_text_pdf(options)

        if options.source.document_type == DocumentType.DOCX:
            return self._extract_text_docx(options)

        raise UnsupportedFormatError(
            f"extract_text does not support {options.source.document_type.value}"
        )

    def extract_images(self, options: ExtractImagesOptions) -> OperationResult:
        """Extract all embedded images from a PDF or DOCX into a directory."""
        self._validate_source(options.source)
        if not options.output_dir.exists():
            raise ValidationError(f"Output directory does not exist: {options.output_dir}")
        if not options.output_dir.is_dir():
            raise ValidationError(f"Output path is not a directory: {options.output_dir}")

        if options.source.document_type == DocumentType.PDF:
            return self._extract_images_pdf(options)

        if options.source.document_type == DocumentType.DOCX:
            return self._extract_images_docx(options)

        raise UnsupportedFormatError(
            f"extract_images does not support {options.source.document_type.value}"
        )

    # ------------------------------------------------------------------ #
    # Text extraction                                                       #
    # ------------------------------------------------------------------ #

    def _extract_text_pdf(self, options: ExtractTextOptions) -> OperationResult:
        fitz = self._load_pymupdf()

        try:
            doc = fitz.open(str(options.source.path))
            lines: list[str] = []
            for page in doc:
                text = page.get_text("text")
                if text.strip():
                    lines.append(text)
            doc.close()

            full_text = "\n\n---\n\n".join(lines)
            options.output_path.write_text(full_text, encoding="utf-8")
        except ValidationError:
            raise
        except Exception as exc:
            raise ProcessingError(f"Failed to extract text from PDF: {options.source.path}") from exc

        char_count = len(full_text)
        return OperationResult(
            success=True,
            output_files=[options.output_path],
            message=f"Extracted text from {options.source.path.name} ({char_count} characters)",
            metadata={
                "char_count": char_count,
                "page_count": len(lines),
                "source_format": "pdf",
            },
        )

    def _extract_text_docx(self, options: ExtractTextOptions) -> OperationResult:
        docx_module = self._load_python_docx()

        try:
            document = docx_module.Document(str(options.source.path))
            paragraphs = [para.text for para in document.paragraphs if para.text.strip()]
            full_text = "\n\n".join(paragraphs)
            options.output_path.write_text(full_text, encoding="utf-8")
        except ValidationError:
            raise
        except Exception as exc:
            raise ProcessingError(f"Failed to extract text from DOCX: {options.source.path}") from exc

        char_count = len(full_text)
        return OperationResult(
            success=True,
            output_files=[options.output_path],
            message=f"Extracted text from {options.source.path.name} ({char_count} characters)",
            metadata={
                "char_count": char_count,
                "paragraph_count": len(paragraphs),
                "source_format": "docx",
            },
        )

    # ------------------------------------------------------------------ #
    # Image extraction                                                      #
    # ------------------------------------------------------------------ #

    def _extract_images_pdf(self, options: ExtractImagesOptions) -> OperationResult:
        fitz = self._load_pymupdf()
        stem = options.source.path.stem

        try:
            doc = fitz.open(str(options.source.path))
            output_files: list[Path] = []

            for page_index, page in enumerate(doc, start=1):
                images = page.get_images(full=True)
                for image_index, image_info in enumerate(images, start=1):
                    xref = image_info[0]
                    base_image = doc.extract_image(xref)
                    image_bytes = base_image["image"]
                    image_ext = base_image["ext"]

                    filename = f"{stem}_page{page_index:04d}_img{image_index:04d}.{image_ext}"
                    output_path = options.output_dir / filename
                    output_path.write_bytes(image_bytes)
                    output_files.append(output_path)

            doc.close()
        except ValidationError:
            raise
        except Exception as exc:
            raise ProcessingError(f"Failed to extract images from PDF: {options.source.path}") from exc

        return OperationResult(
            success=True,
            output_files=output_files,
            message=f"Extracted {len(output_files)} image(s) from {options.source.path.name}",
            metadata={
                "image_count": len(output_files),
                "source_format": "pdf",
            },
        )

    def _extract_images_docx(self, options: ExtractImagesOptions) -> OperationResult:
        docx_module = self._load_python_docx()
        stem = options.source.path.stem

        try:
            document = docx_module.Document(str(options.source.path))
            output_files: list[Path] = []

            for index, rel in enumerate(document.part.rels.values(), start=1):
                # Only process image relationships
                if "image" not in rel.reltype:
                    continue

                image_part = rel.target_part
                image_ext = image_part.content_type.split("/")[-1]
                # Normalise common content-type aliases
                if image_ext in {"jpeg"}:
                    image_ext = "jpg"

                filename = f"{stem}_img{index:04d}.{image_ext}"
                output_path = options.output_dir / filename
                output_path.write_bytes(image_part.blob)
                output_files.append(output_path)
        except ValidationError:
            raise
        except Exception as exc:
            raise ProcessingError(f"Failed to extract images from DOCX: {options.source.path}") from exc

        return OperationResult(
            success=True,
            output_files=output_files,
            message=f"Extracted {len(output_files)} image(s) from {options.source.path.name}",
            metadata={
                "image_count": len(output_files),
                "source_format": "docx",
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

    def _validate_output_path(self, output_path: Path) -> None:
        parent = output_path.parent
        if str(parent) in {"", "."}:
            return
        if not parent.exists():
            raise ValidationError(f"Output directory does not exist: {parent}")

    # ------------------------------------------------------------------ #
    # Lazy imports                                                          #
    # ------------------------------------------------------------------ #

    def _load_pymupdf(self) -> Any:
        try:
            return importlib.import_module("fitz")
        except ImportError as exc:
            raise ProcessingError(
                "extract_text/extract_images from PDF requires the 'pymupdf' package to be installed"
            ) from exc

    def _load_python_docx(self) -> Any:
        try:
            return importlib.import_module("docx")
        except ImportError as exc:
            raise ProcessingError(
                "extract_text/extract_images from DOCX requires the 'python-docx' package to be installed"
            ) from exc
