from __future__ import annotations

import importlib
from copy import deepcopy
from dataclasses import dataclass, field
from enum import StrEnum
from pathlib import Path
from typing import Any

from document_tools.exceptions import ProcessingError, UnsupportedFormatError, ValidationError
from document_tools.models import DocumentInput, DocumentType, OperationResult, PageRange


class SplitMode(StrEnum):
    SINGLE_PAGES = "single_pages"
    PAGE_RANGES = "page_ranges"
    SECTION_BREAKS = "section_breaks"


@dataclass(slots=True, frozen=True)
class SplitOptions:
    source: DocumentInput
    output_dir: Path
    mode: SplitMode
    ranges: list[PageRange] = field(default_factory=list)


class SplitService:
    def split(self, options: SplitOptions) -> OperationResult:
        self._validate_inputs(options)

        if options.source.document_type == DocumentType.PDF:
            return self._split_pdf(options)

        if options.source.document_type == DocumentType.DOCX:
            return self._split_docx(options)

        raise UnsupportedFormatError(f"Split is not supported for {options.source.document_type.value}")

    def _validate_inputs(self, options: SplitOptions) -> None:
        if not options.source.path.exists():
            raise ValidationError(f"Source file does not exist: {options.source.path}")
        if not options.source.path.is_file():
            raise ValidationError(f"Source path is not a file: {options.source.path}")
        if not options.output_dir.exists():
            raise ValidationError(f"Output directory does not exist: {options.output_dir}")

        if options.mode == SplitMode.PAGE_RANGES and not options.ranges:
            raise ValidationError("PAGE_RANGES mode requires at least one PageRange")

        if options.mode == SplitMode.SECTION_BREAKS and options.source.document_type != DocumentType.DOCX:
            raise ValidationError("SECTION_BREAKS mode is only valid for DOCX documents")

    def _split_pdf(self, options: SplitOptions) -> OperationResult:
        if options.mode == SplitMode.SECTION_BREAKS:
            raise UnsupportedFormatError("PDF does not support section break splitting")

        pypdf = self._load_pypdf()

        try:
            reader = pypdf.PdfReader(str(options.source.path))
            writer_class = pypdf.PdfWriter
            self._unlock_reader_if_needed(reader, options.source)
            total_pages = len(reader.pages)

            if options.mode == SplitMode.SINGLE_PAGES:
                output_files = self._split_pdf_single_pages(reader, options, writer_class)
            else:
                output_files = self._split_pdf_ranges(reader, options, writer_class, total_pages)
        except ValidationError:
            raise
        except Exception as exc:
            raise ProcessingError(f"Failed to split PDF file: {options.source.path}") from exc

        return OperationResult(
            success=True,
            output_files=output_files,
            message=f"Created {len(output_files)} PDF file(s) from {options.source.path.name}",
            metadata={
                "source_pages": total_pages,
                "output_count": len(output_files),
                "mode": options.mode.value,
            },
        )

    def _split_docx(self, options: SplitOptions) -> OperationResult:
        if options.mode in {SplitMode.SINGLE_PAGES, SplitMode.PAGE_RANGES}:
            raise UnsupportedFormatError(
                "DOCX page-based split depends on a rendering engine and is intentionally deferred."
            )

        docx_module, qn = self._load_docx_dependencies()

        try:
            document = docx_module.Document(str(options.source.path))
            segments = self._build_docx_section_segments(document._element.body, qn)
            output_files: list[Path] = []

            for index, (elements, sect_pr) in enumerate(segments, start=1):
                output_path = options.output_dir / f"{options.source.path.stem}_section_{index:04d}.docx"
                section_document = docx_module.Document()
                body = section_document._element.body
                self._clear_docx_body(body)

                for element in elements:
                    body.append(deepcopy(element))

                body.append(deepcopy(sect_pr))
                section_document.save(str(output_path))
                output_files.append(output_path)
        except ValidationError:
            raise
        except Exception as exc:
            raise ProcessingError(f"Failed to split DOCX file: {options.source.path}") from exc

        return OperationResult(
            success=True,
            output_files=output_files,
            message=f"Created {len(output_files)} DOCX file(s) from {options.source.path.name}",
            metadata={
                "output_count": len(output_files),
                "mode": options.mode.value,
            },
        )

    def _split_pdf_single_pages(self, reader: Any, options: SplitOptions, writer_class: Any) -> list[Path]:
        output_files: list[Path] = []

        for index, page in enumerate(reader.pages, start=1):
            output_path = options.output_dir / f"{options.source.path.stem}_page_{index:04d}.pdf"
            writer = writer_class()
            writer.add_page(page)

            with output_path.open("wb") as output_file:
                writer.write(output_file)

            output_files.append(output_path)

        return output_files

    def _split_pdf_ranges(self, reader: Any, options: SplitOptions, writer_class: Any, total_pages: int) -> list[Path]:
        output_files: list[Path] = []

        for page_range in options.ranges:
            if page_range.end > total_pages:
                raise ValidationError(
                    f"Page range {page_range.start}-{page_range.end} exceeds total pages ({total_pages})"
                )

            output_path = options.output_dir / (
                f"{options.source.path.stem}_pages_{page_range.start:04d}-{page_range.end:04d}.pdf"
            )
            writer = writer_class()
            for zero_based_index in page_range.to_zero_based():
                writer.add_page(reader.pages[zero_based_index])

            with output_path.open("wb") as output_file:
                writer.write(output_file)

            output_files.append(output_path)

        return output_files

    def _unlock_reader_if_needed(self, reader: Any, source: DocumentInput) -> None:
        if not getattr(reader, "is_encrypted", False):
            return

        if not source.password:
            raise ValidationError(f"PDF is encrypted but no password was provided: {source.path}")

        decrypt_result = reader.decrypt(source.password)
        if decrypt_result == 0:
            raise ValidationError(f"Failed to decrypt PDF with the supplied password: {source.path}")

    def _build_docx_section_segments(self, body: Any, qn: Any) -> list[tuple[list[Any], Any]]:
        segments: list[tuple[list[Any], Any]] = []
        current_elements: list[Any] = []
        final_sect_pr = deepcopy(body.sectPr)

        for child in body.iterchildren():
            if child.tag == qn("w:sectPr"):
                continue

            cloned_child = deepcopy(child)
            section_props = self._extract_paragraph_section_properties(cloned_child, qn)
            if section_props is not None:
                self._remove_paragraph_section_properties(cloned_child, qn)

            current_elements.append(cloned_child)

            if section_props is not None:
                segments.append((current_elements, section_props))
                current_elements = []

        if current_elements or not segments:
            segments.append((current_elements, final_sect_pr))

        return segments

    def _extract_paragraph_section_properties(self, paragraph_element: Any, qn: Any) -> Any | None:
        if paragraph_element.tag != qn("w:p"):
            return None

        paragraph_properties = paragraph_element.find(qn("w:pPr"))
        if paragraph_properties is None:
            return None

        section_properties = paragraph_properties.find(qn("w:sectPr"))
        if section_properties is None:
            return None

        return deepcopy(section_properties)

    def _remove_paragraph_section_properties(self, paragraph_element: Any, qn: Any) -> None:
        paragraph_properties = paragraph_element.find(qn("w:pPr"))
        if paragraph_properties is None:
            return

        section_properties = paragraph_properties.find(qn("w:sectPr"))
        if section_properties is not None:
            paragraph_properties.remove(section_properties)

        if len(paragraph_properties) == 0:
            paragraph_element.remove(paragraph_properties)

    def _clear_docx_body(self, body: Any) -> None:
        for child in list(body.iterchildren()):
            body.remove(child)

    def _load_pypdf(self) -> Any:
        try:
            return importlib.import_module("pypdf")
        except ImportError as exc:
            raise ProcessingError("PDF split requires the 'pypdf' package to be installed") from exc

    def _load_docx_dependencies(self) -> tuple[Any, Any]:
        try:
            docx_module = importlib.import_module("docx")
            qn = importlib.import_module("docx.oxml.ns").qn
            return docx_module, qn
        except ImportError as exc:
            raise ProcessingError("DOCX split requires the 'python-docx' package to be installed") from exc
