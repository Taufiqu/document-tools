from __future__ import annotations

import argparse
import json
import sys
from collections.abc import Sequence
from pathlib import Path

from document_tools.exceptions import DocumentToolsError, ValidationError
from document_tools.features import (
    CompressPdfOptions,
    ConvertOptions,
    ConvertService,
    ExtractImagesOptions,
    ExtractService,
    ExtractTextOptions,
    FaviconOptions,
    ImagesToPdfOptions,
    MergeOptions,
    MergeService,
    PdfToImagesOptions,
    PdfUtilityService,
    RotateOperation,
    SplitMode,
    SplitOptions,
    SplitService,
    WatermarkOptions,
)
from document_tools.models import DocumentInput, OperationResult, OutputFormat, PageRange


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="document-tools",
        description="CLI untuk operasi dokumen lokal berbasis Python",
    )
    subparsers = parser.add_subparsers(dest="command", required=True)

    merge_pdf = subparsers.add_parser("merge-pdf", help="Gabungkan banyak file PDF menjadi satu PDF")
    merge_pdf.add_argument("inputs", nargs="+", help="Daftar file PDF input")
    merge_pdf.add_argument("-o", "--output", required=True, help="Path file PDF output")
    merge_pdf.set_defaults(handler=_handle_merge_pdf)

    merge_docx = subparsers.add_parser("merge-docx", help="Gabungkan banyak file DOCX menjadi satu DOCX")
    merge_docx.add_argument("inputs", nargs="+", help="Daftar file DOCX input")
    merge_docx.add_argument("-o", "--output", required=True, help="Path file DOCX output")
    merge_docx.set_defaults(handler=_handle_merge_docx)

    merge_mixed_pdf = subparsers.add_parser("merge-mixed-pdf", help="Gabungkan campuran PDF dan DOCX menjadi satu PDF")
    merge_mixed_pdf.add_argument("inputs", nargs="+", help="Daftar file PDF dan/atau DOCX input")
    merge_mixed_pdf.add_argument("-o", "--output", required=True, help="Path file PDF output")
    merge_mixed_pdf.set_defaults(handler=_handle_merge_mixed_pdf)

    split_docx = subparsers.add_parser("split-docx", help="Pisahkan file DOCX berdasarkan section break")
    split_docx.add_argument("source", help="Path file DOCX sumber")
    split_docx.add_argument("-o", "--output-dir", required=True, help="Folder output")
    split_docx.set_defaults(handler=_handle_split_docx)

    split_pdf = subparsers.add_parser("split-pdf", help="Pisahkan file PDF")
    split_pdf.add_argument("source", help="Path file PDF sumber")
    split_pdf.add_argument("-o", "--output-dir", required=True, help="Folder output")
    split_mode = split_pdf.add_mutually_exclusive_group(required=True)
    split_mode.add_argument("--single-pages", action="store_true", help="Pisahkan menjadi satu file per halaman")
    split_mode.add_argument("--ranges", help="Rentang halaman, mis. 1-2,4-5")
    split_pdf.set_defaults(handler=_handle_split_pdf)

    delete_pages = subparsers.add_parser("delete-pages", help="Hapus halaman tertentu dari PDF")
    delete_pages.add_argument("source", help="Path file PDF sumber")
    delete_pages.add_argument("-o", "--output", required=True, help="Path file PDF output")
    delete_pages.add_argument("--pages", required=True, help="Nomor halaman yang dihapus, mis. 2,4")
    delete_pages.set_defaults(handler=_handle_delete_pages)

    rotate_pages = subparsers.add_parser("rotate-pages", help="Putar halaman tertentu pada PDF")
    rotate_pages.add_argument("source", help="Path file PDF sumber")
    rotate_pages.add_argument("-o", "--output", required=True, help="Path file PDF output")
    rotate_pages.add_argument("--pages", required=True, help="Nomor halaman yang diputar, mis. 1,3")
    rotate_pages.add_argument("--angle", type=int, required=True, choices=[90, 180, 270], help="Sudut rotasi")
    rotate_pages.set_defaults(handler=_handle_rotate_pages)

    reorder_pages = subparsers.add_parser("reorder-pages", help="Susun ulang urutan halaman PDF")
    reorder_pages.add_argument("source", help="Path file PDF sumber")
    reorder_pages.add_argument("-o", "--output", required=True, help="Path file PDF output")
    reorder_pages.add_argument("--order", required=True, help="Urutan halaman baru, mis. 3,1,2")
    reorder_pages.set_defaults(handler=_handle_reorder_pages)

    compress_pdf = subparsers.add_parser("compress-pdf", help="Kompresi PDF (Smart Vector & Rasterize)")
    compress_pdf.add_argument("source", help="Path file PDF sumber")
    compress_pdf.add_argument("-o", "--output", required=True, help="Path file PDF output")
    compress_pdf.add_argument("--mode", choices=["smart", "rasterize"], default="smart", help="Mode kompresi (smart/rasterize, default: smart)")
    compress_pdf.add_argument("--quality", type=int, default=60, help="Kualitas kompresi gambar 1-100 (default: 60)")
    compress_pdf.add_argument("--dpi", type=int, default=150, help="Resolusi rendering untuk mode rasterize 72-600 (default: 150)")
    compress_pdf.set_defaults(handler=_handle_compress_pdf)

    protect_pdf = subparsers.add_parser("protect-pdf", help="Tambahkan password pada PDF")
    protect_pdf.add_argument("source", help="Path file PDF sumber")
    protect_pdf.add_argument("-o", "--output", required=True, help="Path file PDF output")
    protect_pdf.add_argument("--password", required=True, help="Password PDF")
    protect_pdf.set_defaults(handler=_handle_protect_pdf)

    unlock_pdf = subparsers.add_parser("unlock-pdf", help="Hilangkan password dari PDF")
    unlock_pdf.add_argument("source", help="Path file PDF sumber")
    unlock_pdf.add_argument("-o", "--output", required=True, help="Path file PDF output")
    unlock_pdf.add_argument("--password", required=True, help="Password PDF saat ini")
    unlock_pdf.set_defaults(handler=_handle_unlock_pdf)

    watermark_pdf = subparsers.add_parser("watermark-pdf", help="Tambahkan watermark teks ke PDF")
    watermark_pdf.add_argument("source", help="Path file PDF sumber")
    watermark_pdf.add_argument("-o", "--output", required=True, help="Path file PDF output")
    watermark_pdf.add_argument("--text", required=True, help="Teks watermark")
    watermark_pdf.add_argument("--opacity", type=float, default=0.15, help="Opacity watermark (0-1]")
    watermark_pdf.set_defaults(handler=_handle_watermark_pdf)

    # --- Phase 2: Conversion ---

    convert_pdf_to_docx = subparsers.add_parser("convert-pdf-to-docx", help="Konversi PDF ke DOCX")
    convert_pdf_to_docx.add_argument("source", help="Path file PDF sumber")
    convert_pdf_to_docx.add_argument("-o", "--output", required=True, help="Path file DOCX output")
    convert_pdf_to_docx.set_defaults(handler=_handle_convert_pdf_to_docx)

    convert_docx_to_pdf = subparsers.add_parser("convert-docx-to-pdf", help="Konversi DOCX ke PDF")
    convert_docx_to_pdf.add_argument("source", help="Path file DOCX sumber")
    convert_docx_to_pdf.add_argument("-o", "--output", required=True, help="Path file PDF output")
    convert_docx_to_pdf.set_defaults(handler=_handle_convert_docx_to_pdf)

    convert_pdf_to_images = subparsers.add_parser("convert-pdf-to-images", help="Konversi setiap halaman PDF menjadi gambar")
    convert_pdf_to_images.add_argument("source", help="Path file PDF sumber")
    convert_pdf_to_images.add_argument("-o", "--output-dir", required=True, help="Folder output gambar")
    convert_pdf_to_images.add_argument("--format", dest="image_format", default="png", choices=["png", "jpg", "webp", "tiff"], help="Format gambar output (default: png)")
    convert_pdf_to_images.add_argument("--dpi", type=int, default=150, help="Resolusi gambar dalam DPI (72-600, default: 150)")
    convert_pdf_to_images.set_defaults(handler=_handle_convert_pdf_to_images)

    convert_images_to_pdf = subparsers.add_parser("convert-images-to-pdf", help="Gabungkan satu atau beberapa gambar menjadi satu PDF")
    convert_images_to_pdf.add_argument("inputs", nargs="+", help="Daftar file gambar input (JPG/PNG/WEBP/TIFF/ICO)")
    convert_images_to_pdf.add_argument("-o", "--output", required=True, help="Path file PDF output")
    convert_images_to_pdf.set_defaults(handler=_handle_convert_images_to_pdf)

    generate_favicon = subparsers.add_parser("generate-favicon", help="Buat favicon .ico atau Web Favicon Pack dari gambar")
    generate_favicon.add_argument("source", help="Path file gambar sumber")
    generate_favicon.add_argument("-o", "--output-dir", help="Folder output (default: folder file asal)")
    generate_favicon.add_argument("--web-pack", action="store_true", help="Buat bundle lengkap web icons & HTML tag snippet")
    generate_favicon.add_argument("--sizes", help="Daftar ukuran kustom, misal 16,32,48,256")
    generate_favicon.add_argument("--html", action="store_true", help="Generate file tag HTML snippet")
    generate_favicon.set_defaults(handler=_handle_generate_favicon)

    convert_pdf_to_md = subparsers.add_parser("convert-pdf-to-md", help="Konversi teks PDF ke Markdown")
    convert_pdf_to_md.add_argument("source", help="Path file PDF sumber")
    convert_pdf_to_md.add_argument("-o", "--output", required=True, help="Path file Markdown output")
    convert_pdf_to_md.set_defaults(handler=_handle_convert_pdf_to_md)

    convert_docx_to_md = subparsers.add_parser("convert-docx-to-md", help="Konversi DOCX ke Markdown")
    convert_docx_to_md.add_argument("source", help="Path file DOCX sumber")
    convert_docx_to_md.add_argument("-o", "--output", required=True, help="Path file Markdown output")
    convert_docx_to_md.set_defaults(handler=_handle_convert_docx_to_md)

    convert_pdf_to_xlsx = subparsers.add_parser("convert-pdf-to-xlsx", help="Ekstrak tabel dari PDF ke Excel (best-effort)")
    convert_pdf_to_xlsx.add_argument("source", help="Path file PDF sumber")
    convert_pdf_to_xlsx.add_argument("-o", "--output", required=True, help="Path file XLSX output")
    convert_pdf_to_xlsx.set_defaults(handler=_handle_convert_pdf_to_xlsx)

    convert_xlsx_to_pdf = subparsers.add_parser("convert-xlsx-to-pdf", help="Konversi file Excel ke PDF")
    convert_xlsx_to_pdf.add_argument("source", help="Path file XLSX sumber")
    convert_xlsx_to_pdf.add_argument("-o", "--output", required=True, help="Path file PDF output")
    convert_xlsx_to_pdf.set_defaults(handler=_handle_convert_xlsx_to_pdf)

    # --- Phase 2: Extraction ---

    extract_text = subparsers.add_parser("extract-text", help="Ekstrak teks dari PDF atau DOCX ke file .txt")
    extract_text.add_argument("source", help="Path file PDF atau DOCX sumber")
    extract_text.add_argument("-o", "--output", required=True, help="Path file .txt output")
    extract_text.set_defaults(handler=_handle_extract_text)

    extract_images = subparsers.add_parser("extract-images", help="Ekstrak semua gambar dari PDF atau DOCX ke folder")
    extract_images.add_argument("source", help="Path file PDF atau DOCX sumber")
    extract_images.add_argument("-o", "--output-dir", required=True, help="Folder output gambar")
    extract_images.set_defaults(handler=_handle_extract_images)

    gui = subparsers.add_parser("gui", help="Buka aplikasi desktop GUI (CustomTkinter)")
    gui.set_defaults(handler=_handle_gui)

    return parser


def main(argv: Sequence[str] | None = None) -> int:
    args_list = list(argv) if argv is not None else sys.argv[1:]
    if not args_list:
        args_list = ["gui"]

    parser = build_parser()
    args = parser.parse_args(args_list)

    try:
        result = args.handler(args)
    except DocumentToolsError as exc:
        print(f"Error: {exc}", file=sys.stderr)
        return 1

    print(json.dumps(_serialize_result(result), indent=2))
    return 0


def _handle_merge_pdf(args: argparse.Namespace):
    service = MergeService()
    return service.merge(
        MergeOptions(
            inputs=[DocumentInput.from_path(path) for path in args.inputs],
            output_path=Path(args.output),
            output_format=OutputFormat.PDF,
        )
    )


def _handle_merge_docx(args: argparse.Namespace):
    service = MergeService()
    return service.merge(
        MergeOptions(
            inputs=[DocumentInput.from_path(path) for path in args.inputs],
            output_path=Path(args.output),
            output_format=OutputFormat.DOCX,
        )
    )


def _handle_merge_mixed_pdf(args: argparse.Namespace):
    service = MergeService()
    return service.merge(
        MergeOptions(
            inputs=[DocumentInput.from_path(path) for path in args.inputs],
            output_path=Path(args.output),
            output_format=OutputFormat.PDF,
        )
    )


def _handle_split_docx(args: argparse.Namespace):
    service = SplitService()
    return service.split(
        SplitOptions(
            source=DocumentInput.from_path(args.source),
            output_dir=Path(args.output_dir),
            mode=SplitMode.SECTION_BREAKS,
        )
    )


def _handle_split_pdf(args: argparse.Namespace):
    mode = SplitMode.SINGLE_PAGES if args.single_pages else SplitMode.PAGE_RANGES
    ranges = [] if mode == SplitMode.SINGLE_PAGES else _parse_page_ranges(args.ranges)

    service = SplitService()
    return service.split(
        SplitOptions(
            source=DocumentInput.from_path(args.source),
            output_dir=Path(args.output_dir),
            mode=mode,
            ranges=ranges,
        )
    )


def _handle_delete_pages(args: argparse.Namespace):
    service = PdfUtilityService()
    return service.delete_pages(
        source=DocumentInput.from_path(args.source),
        output_path=Path(args.output),
        page_indexes=_parse_page_numbers(args.pages),
    )


def _handle_rotate_pages(args: argparse.Namespace):
    service = PdfUtilityService()
    return service.rotate_pages(
        source=DocumentInput.from_path(args.source),
        output_path=Path(args.output),
        operation=RotateOperation(pages=_parse_page_numbers(args.pages), angle=args.angle),
    )


def _handle_reorder_pages(args: argparse.Namespace):
    service = PdfUtilityService()
    return service.reorder_pages(
        source=DocumentInput.from_path(args.source),
        output_path=Path(args.output),
        page_order=_parse_page_numbers(args.order),
    )


def _handle_compress_pdf(args: argparse.Namespace):
    service = PdfUtilityService()
    return service.compress_pdf(
        source=DocumentInput.from_path(args.source),
        output_path=Path(args.output),
        options=CompressPdfOptions(
            source=DocumentInput.from_path(args.source),
            output_path=Path(args.output),
            mode=args.mode,
            quality=args.quality,
            dpi=args.dpi,
        ),
    )


def _handle_protect_pdf(args: argparse.Namespace):
    service = PdfUtilityService()
    return service.protect_pdf(
        source=DocumentInput.from_path(args.source),
        output_path=Path(args.output),
        password=args.password,
    )


def _handle_unlock_pdf(args: argparse.Namespace):
    service = PdfUtilityService()
    return service.unlock_pdf(
        source=DocumentInput.from_path(args.source),
        output_path=Path(args.output),
        password=args.password,
    )


def _handle_watermark_pdf(args: argparse.Namespace):
    service = PdfUtilityService()
    return service.watermark_pdf(
        source=DocumentInput.from_path(args.source),
        output_path=Path(args.output),
        options=WatermarkOptions(text=args.text, opacity=args.opacity),
    )


# --- Phase 2: Conversion handlers ---


def _handle_convert_pdf_to_docx(args: argparse.Namespace):
    service = ConvertService()
    return service.convert(
        ConvertOptions(
            source=DocumentInput.from_path(args.source),
            output_path=Path(args.output),
            output_format=OutputFormat.DOCX,
        )
    )


def _handle_convert_docx_to_pdf(args: argparse.Namespace):
    service = ConvertService()
    return service.convert(
        ConvertOptions(
            source=DocumentInput.from_path(args.source),
            output_path=Path(args.output),
            output_format=OutputFormat.PDF,
        )
    )


def _handle_convert_pdf_to_images(args: argparse.Namespace):
    service = ConvertService()
    return service.pdf_to_images(
        PdfToImagesOptions(
            source=DocumentInput.from_path(args.source),
            output_dir=Path(args.output_dir),
            image_format=args.image_format,
            dpi=args.dpi,
        )
    )


def _handle_convert_images_to_pdf(args: argparse.Namespace):
    service = ConvertService()
    return service.images_to_pdf(
        ImagesToPdfOptions(
            sources=[DocumentInput.from_path(path) for path in args.inputs],
            output_path=Path(args.output),
        )
    )


def _handle_generate_favicon(args: argparse.Namespace):
    service = ConvertService()
    sizes = _parse_page_numbers(args.sizes) if args.sizes else None
    out_dir = Path(args.output_dir) if args.output_dir else Path(args.source).parent
    return service.generate_favicon(
        FaviconOptions(
            source=DocumentInput.from_path(args.source),
            output_dir=out_dir,
            sizes=sizes,
            web_pack=args.web_pack,
            generate_html=args.html or args.web_pack,
        )
    )


def _handle_convert_pdf_to_md(args: argparse.Namespace):
    service = ConvertService()
    return service.convert(
        ConvertOptions(
            source=DocumentInput.from_path(args.source),
            output_path=Path(args.output),
            output_format=OutputFormat.MARKDOWN,
        )
    )


def _handle_convert_docx_to_md(args: argparse.Namespace):
    service = ConvertService()
    return service.convert(
        ConvertOptions(
            source=DocumentInput.from_path(args.source),
            output_path=Path(args.output),
            output_format=OutputFormat.MARKDOWN,
        )
    )


def _handle_convert_pdf_to_xlsx(args: argparse.Namespace):
    service = ConvertService()
    return service.convert(
        ConvertOptions(
            source=DocumentInput.from_path(args.source),
            output_path=Path(args.output),
            output_format=OutputFormat.XLSX,
        )
    )


def _handle_convert_xlsx_to_pdf(args: argparse.Namespace):
    service = ConvertService()
    return service.convert(
        ConvertOptions(
            source=DocumentInput.from_path(args.source),
            output_path=Path(args.output),
            output_format=OutputFormat.PDF,
        )
    )


# --- Phase 2: Extraction handlers ---


def _handle_extract_text(args: argparse.Namespace):
    service = ExtractService()
    return service.extract_text(
        ExtractTextOptions(
            source=DocumentInput.from_path(args.source),
            output_path=Path(args.output),
        )
    )


def _handle_extract_images(args: argparse.Namespace):
    service = ExtractService()
    return service.extract_images(
        ExtractImagesOptions(
            source=DocumentInput.from_path(args.source),
            output_dir=Path(args.output_dir),
        )
    )


def _parse_page_numbers(raw_value: str) -> list[int]:
    tokens = [token.strip() for token in raw_value.split(",") if token.strip()]
    if not tokens:
        raise ValidationError("At least one page number is required")

    page_numbers: list[int] = []
    for token in tokens:
        try:
            page_numbers.append(int(token))
        except ValueError as exc:
            raise ValidationError(f"Invalid page number: {token}") from exc

    return page_numbers


def _parse_page_ranges(raw_value: str) -> list[PageRange]:
    tokens = [token.strip() for token in raw_value.split(",") if token.strip()]
    if not tokens:
        raise ValidationError("At least one page range is required")

    ranges: list[PageRange] = []
    for token in tokens:
        if "-" not in token:
            raise ValidationError(f"Invalid range format: {token}. Use start-end")

        start_raw, end_raw = token.split("-", maxsplit=1)
        try:
            ranges.append(PageRange(start=int(start_raw), end=int(end_raw)))
        except ValueError as exc:
            raise ValidationError(f"Invalid range value: {token}") from exc

    return ranges


def _handle_gui(args: argparse.Namespace) -> OperationResult:
    from document_tools.gui.app import main as launch_gui
    launch_gui()
    return OperationResult(success=True, message="GUI closed")


def _serialize_result(result: OperationResult) -> dict[str, object]:
    return {
        "success": result.success,
        "output_files": [str(path) for path in result.output_files],
        "message": result.message,
        "metadata": result.metadata,
    }


if __name__ == "__main__":
    raise SystemExit(main())
