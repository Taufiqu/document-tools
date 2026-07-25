from __future__ import annotations

import importlib
import shutil
import subprocess
import tempfile
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from document_tools.exceptions import ProcessingError, UnsupportedFormatError, ValidationError
from document_tools.models import DocumentInput, DocumentType, OperationResult, OutputFormat


@dataclass(slots=True, frozen=True)
class MergeOptions:
    inputs: list[DocumentInput]
    output_path: Path
    output_format: OutputFormat


class MergeService:
    def merge(self, options: MergeOptions) -> OperationResult:
        self._validate_inputs(options)

        input_types = {item.document_type for item in options.inputs}
        if input_types == {DocumentType.PDF} and options.output_format == OutputFormat.PDF:
            return self._merge_pdf(options)

        if input_types == {DocumentType.DOCX} and options.output_format == OutputFormat.DOCX:
            return self._merge_docx(options)

        if input_types.issubset({DocumentType.PDF, DocumentType.DOCX}) and options.output_format == OutputFormat.PDF:
            return self._merge_mixed_to_pdf(options)

        if input_types.issubset({DocumentType.PDF, DocumentType.DOCX}) and options.output_format == OutputFormat.DOCX:
            raise UnsupportedFormatError(
                "Mixed PDF + DOCX to DOCX is not implemented yet because it depends on a reliable PDF-to-Word conversion path."
            )

        raise UnsupportedFormatError(
            f"Unsupported merge route for input types={sorted(item.value for item in input_types)} and output_format={options.output_format.value}"
        )

    def _validate_inputs(self, options: MergeOptions) -> None:
        if not options.inputs:
            raise ValidationError("Merge requires at least one input document")

        for item in options.inputs:
            if not item.path.exists():
                raise ValidationError(f"Input file does not exist: {item.path}")
            if not item.path.is_file():
                raise ValidationError(f"Input path is not a file: {item.path}")

        parent = options.output_path.parent
        if str(parent) in {"", "."}:
            return

        if not parent.exists():
            raise ValidationError(f"Output directory does not exist: {parent}")

    def _merge_pdf(self, options: MergeOptions) -> OperationResult:
        return self._merge_pdf_inputs(
            inputs=options.inputs,
            output_path=options.output_path,
            output_format=options.output_format,
            input_count=len(options.inputs),
            converted_docx_count=0,
        )

    def _merge_docx(self, options: MergeOptions) -> OperationResult:
        docx_module, composer_module = self._load_docx_dependencies()

        try:
            base_document = docx_module.Document(str(options.inputs[0].path))
            composer = composer_module.Composer(base_document)

            for item in options.inputs[1:]:
                composer.append(docx_module.Document(str(item.path)))

            composer.save(str(options.output_path))
            merged_document = docx_module.Document(str(options.output_path))
        except Exception as exc:
            raise ProcessingError(f"Failed to merge DOCX files into {options.output_path}") from exc

        return OperationResult(
            success=True,
            output_files=[options.output_path],
            message=f"Merged {len(options.inputs)} DOCX files into {options.output_path.name}",
            metadata={
                "input_count": len(options.inputs),
                "paragraph_count": len(merged_document.paragraphs),
                "output_format": options.output_format.value,
            },
        )

    def _merge_mixed_to_pdf(self, options: MergeOptions) -> OperationResult:
        converted_inputs: list[DocumentInput] = []
        converted_docx_count = 0

        try:
            with tempfile.TemporaryDirectory(prefix="document-tools-mixed-") as temp_dir_name:
                temp_dir = Path(temp_dir_name)

                for item in options.inputs:
                    if item.document_type == DocumentType.PDF:
                        converted_inputs.append(item)
                        continue

                    if item.document_type != DocumentType.DOCX:
                        raise UnsupportedFormatError(f"Mixed PDF merge does not support {item.document_type.value}")

                    converted_pdf_path = self._convert_docx_to_pdf(item.path, temp_dir)
                    converted_inputs.append(DocumentInput.from_path(converted_pdf_path))
                    converted_docx_count += 1

                return self._merge_pdf_inputs(
                    inputs=converted_inputs,
                    output_path=options.output_path,
                    output_format=options.output_format,
                    input_count=len(options.inputs),
                    converted_docx_count=converted_docx_count,
                )
        except ValidationError:
            raise
        except UnsupportedFormatError:
            raise
        except ProcessingError:
            raise
        except Exception as exc:
            raise ProcessingError(f"Failed to merge mixed PDF/DOCX files into {options.output_path}") from exc

    def _merge_pdf_inputs(
        self,
        inputs: list[DocumentInput],
        output_path: Path,
        output_format: OutputFormat,
        input_count: int,
        converted_docx_count: int,
    ) -> OperationResult:
        pypdf = self._load_pypdf()
        writer = pypdf.PdfWriter()
        total_pages = 0

        try:
            for item in inputs:
                reader = pypdf.PdfReader(str(item.path))
                self._unlock_reader_if_needed(reader, item)

                for page in reader.pages:
                    writer.add_page(page)
                    total_pages += 1

            with output_path.open("wb") as output_file:
                writer.write(output_file)
        except ValidationError:
            raise
        except Exception as exc:
            raise ProcessingError(f"Failed to merge PDF files into {output_path}") from exc

        return OperationResult(
            success=True,
            output_files=[output_path],
            message=f"Merged {input_count} document(s) into {output_path.name}",
            metadata={
                "input_count": input_count,
                "page_count": total_pages,
                "output_format": output_format.value,
                "converted_docx_count": converted_docx_count,
            },
        )

    def _unlock_reader_if_needed(self, reader: Any, item: DocumentInput) -> None:
        if not getattr(reader, "is_encrypted", False):
            return

        if not item.password:
            raise ValidationError(f"PDF is encrypted but no password was provided: {item.path}")

        decrypt_result = reader.decrypt(item.password)
        if decrypt_result == 0:
            raise ValidationError(f"Failed to decrypt PDF with the supplied password: {item.path}")

    def _convert_docx_to_pdf(self, source_path: Path, output_dir: Path) -> Path:
        office_binary = self._find_office_binary()
        if office_binary is None:
            raise ProcessingError(
                "Mixed DOCX + PDF to PDF requires LibreOffice or soffice to be installed and available in PATH"
            )

        process = subprocess.run(
            [
                office_binary,
                "--headless",
                "--convert-to",
                "pdf:writer_pdf_Export",
                "--outdir",
                str(output_dir),
                str(source_path),
            ],
            capture_output=True,
            text=True,
            check=False,
        )
        if process.returncode != 0:
            stderr = process.stderr.strip() or process.stdout.strip() or "Unknown LibreOffice conversion error"
            raise ProcessingError(f"Failed to convert DOCX to PDF: {stderr}")

        output_path = output_dir / f"{source_path.stem}.pdf"
        if not output_path.exists():
            raise ProcessingError(f"LibreOffice did not produce the expected PDF output: {output_path}")

        return output_path

    def _find_office_binary(self) -> str | None:
        return shutil.which("libreoffice") or shutil.which("soffice")

    def _load_pypdf(self) -> Any:
        try:
            return importlib.import_module("pypdf")
        except ImportError as exc:
            raise ProcessingError("PDF merge requires the 'pypdf' package to be installed") from exc

    def _load_docx_dependencies(self) -> tuple[Any, Any]:
        try:
            docx_module = importlib.import_module("docx")
            composer_module = importlib.import_module("docxcompose.composer")
            return docx_module, composer_module
        except ImportError as exc:
            raise ProcessingError(
                "DOCX merge requires the 'python-docx' and 'docxcompose' packages to be installed"
            ) from exc
