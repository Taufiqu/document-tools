"""PDF Utilities view tab for Delete/Rotate/Reorder/Compress/Protect/Unlock/Watermark operations."""
from __future__ import annotations

import threading
from pathlib import Path
import tkinter as tk
import customtkinter as ctk

from document_tools.features import PdfUtilityService, RotateOperation, WatermarkOptions
from document_tools.models import DocumentInput
from document_tools.exceptions import DocumentToolsError
from document_tools.gui import theme as T
from document_tools.gui.widgets import FilePicker, ResultCard, ProgressWidget


class PdfUtilsView(ctk.CTkFrame):
    """
    PdfUtilsView handles various PDF-specific utility operations:
    Delete Pages, Rotate Pages, Reorder Pages, Compress, Protect, Unlock, Watermark.
    """

    def __init__(self, master: tk.Widget, **kwargs: object) -> None:
        super().__init__(master, fg_color="transparent", **kwargs)
        self._pdf_service = PdfUtilityService()

        # Title
        ctk.CTkLabel(
            self, text="PDF Utilities", font=T.FONT_TITLE, text_color=T.TEXT_PRIMARY
        ).pack(anchor="w", pady=(0, T.PAD_MD))

        # Main scrollable content
        content = ctk.CTkScrollableFrame(self, fg_color="transparent", border_width=0)
        content.pack(fill="both", expand=True)

        # Source File Picker
        self._source_picker = FilePicker(
            content,
            label="Source PDF File",
            mode="file",
            filetypes=[("PDF files", "*.pdf")],
            placeholder="Select a PDF file to process",
        )
        self._source_picker.pack(fill="x", pady=(0, T.PAD_MD))

        # Optional Password field
        password_frame = ctk.CTkFrame(content, fg_color="transparent")
        ctk.CTkLabel(
            password_frame, text="Current PDF Password (if encrypted)", font=T.FONT_SM, text_color=T.TEXT_SECONDARY
        ).pack(side="left", padx=(0, T.PAD_MD))
        self._password_entry = ctk.CTkEntry(
            password_frame,
            placeholder_text="Optional",
            show="*",
            font=T.FONT_SM,
            width=150,
        )
        self._password_entry.pack(side="left")
        password_frame.pack(anchor="w", pady=(0, T.PAD_MD))

        # Operation Selector Section
        ctk.CTkLabel(
            content, text="Select Operation", font=T.FONT_LG, text_color=T.TEXT_PRIMARY
        ).pack(anchor="w", pady=(T.PAD_SM, T.PAD_SM))

        self._op_var = tk.StringVar(value="delete")
        self._op_selector = ctk.CTkOptionMenu(
            content,
            values=["delete", "rotate", "reorder", "compress", "protect", "unlock", "watermark"],
            variable=self._op_var,
            font=T.FONT_SM,
            command=self._on_operation_change,
        )
        self._op_selector.pack(anchor="w", pady=(0, T.PAD_MD))

        # Dynamic Operation Fields Frame
        self._dynamic_frame = ctk.CTkFrame(content, fg_color=T.BG_CARD)
        self._dynamic_frame.pack(fill="x", pady=(0, T.PAD_MD))
        self._dynamic_frame.grid_columnconfigure(1, weight=1)

        # Output Picker
        self._output_picker = FilePicker(
            content,
            label="Save Output To",
            mode="file",
            filetypes=[("PDF files", "*.pdf")],
            placeholder="Choose output PDF file location",
        )
        self._output_picker.pack(fill="x", pady=T.PAD_MD)

        # Run Button
        self._run_btn = ctk.CTkButton(
            content,
            text="Execute PDF Utility",
            font=T.FONT_MD,
            height=40,
            command=self._start_operation,
        )
        self._run_btn.pack(fill="x", pady=T.PAD_MD)

        # Progress & Results
        self._progress = ProgressWidget(content)
        self._progress.pack(fill="x")

        self._result = ResultCard(content)
        self._result.pack(fill="x")

        # Initialize operation views
        self._on_operation_change(self._op_var.get())

    def _clear_dynamic_frame(self) -> None:
        for widget in self._dynamic_frame.winfo_children():
            widget.grid_forget()

    def _on_operation_change(self, op: str) -> None:
        self._clear_dynamic_frame()

        if op == "delete":
            ctk.CTkLabel(
                self._dynamic_frame, text="Pages to Delete", font=T.FONT_SM, text_color=T.TEXT_SECONDARY
            ).grid(row=0, column=0, sticky="w", padx=(T.PAD_MD, 0), pady=T.PAD_MD)
            self._delete_pages_entry = ctk.CTkEntry(
                self._dynamic_frame, placeholder_text="e.g. 2, 4-6, 8", font=T.FONT_SM
            )
            self._delete_pages_entry.grid(row=0, column=1, sticky="ew", padx=(T.PAD_MD, T.PAD_MD), pady=T.PAD_MD)

        elif op == "rotate":
            ctk.CTkLabel(
                self._dynamic_frame, text="Pages to Rotate", font=T.FONT_SM, text_color=T.TEXT_SECONDARY
            ).grid(row=0, column=0, sticky="w", padx=(T.PAD_MD, 0), pady=(T.PAD_MD, T.PAD_XS))
            self._rotate_pages_entry = ctk.CTkEntry(
                self._dynamic_frame, placeholder_text="e.g. 1, 3-5 (or 'all')", font=T.FONT_SM
            )
            self._rotate_pages_entry.grid(row=0, column=1, sticky="ew", padx=(T.PAD_MD, T.PAD_MD), pady=(T.PAD_MD, T.PAD_XS))

            ctk.CTkLabel(
                self._dynamic_frame, text="Rotation Angle", font=T.FONT_SM, text_color=T.TEXT_SECONDARY
            ).grid(row=1, column=0, sticky="w", padx=(T.PAD_MD, 0), pady=(T.PAD_XS, T.PAD_MD))
            self._rotate_angle_var = tk.StringVar(value="90")
            rotate_angle_menu = ctk.CTkOptionMenu(
                self._dynamic_frame, values=["90", "180", "270"], variable=self._rotate_angle_var, font=T.FONT_SM
            )
            rotate_angle_menu.grid(row=1, column=1, sticky="w", padx=(T.PAD_MD, T.PAD_MD), pady=(T.PAD_XS, T.PAD_MD))

        elif op == "reorder":
            ctk.CTkLabel(
                self._dynamic_frame, text="New Page Order", font=T.FONT_SM, text_color=T.TEXT_SECONDARY
            ).grid(row=0, column=0, sticky="w", padx=(T.PAD_MD, 0), pady=T.PAD_MD)
            self._reorder_entry = ctk.CTkEntry(
                self._dynamic_frame, placeholder_text="e.g. 3, 2, 1, 4 (must contain all pages)", font=T.FONT_SM
            )
            self._reorder_entry.grid(row=0, column=1, sticky="ew", padx=(T.PAD_MD, T.PAD_MD), pady=T.PAD_MD)

        elif op == "compress":
            ctk.CTkLabel(
                self._dynamic_frame, text="Compression Mode", font=T.FONT_SM, text_color=T.TEXT_SECONDARY
            ).grid(row=0, column=0, sticky="w", padx=(T.PAD_MD, 0), pady=(T.PAD_MD, T.PAD_XS))

            self._compress_mode_var = tk.StringVar(value="Smart Vektor")
            compress_mode_menu = ctk.CTkOptionMenu(
                self._dynamic_frame,
                values=["Smart Vektor", "Full Rasterize"],
                variable=self._compress_mode_var,
                font=T.FONT_SM,
            )
            compress_mode_menu.grid(row=0, column=1, sticky="w", padx=(T.PAD_MD, T.PAD_MD), pady=(T.PAD_MD, T.PAD_XS))

            ctk.CTkLabel(
                self._dynamic_frame, text="Image Quality", font=T.FONT_SM, text_color=T.TEXT_SECONDARY
            ).grid(row=1, column=0, sticky="w", padx=(T.PAD_MD, 0), pady=(T.PAD_XS, T.PAD_MD))

            self._compress_quality_var = tk.IntVar(value=60)
            compress_quality_frame = ctk.CTkFrame(self._dynamic_frame, fg_color="transparent")
            self._compress_quality_slider = ctk.CTkSlider(
                compress_quality_frame,
                from_=10,
                to=100,
                number_of_steps=90,
                variable=self._compress_quality_var,
                width=180,
            )
            self._compress_quality_slider.pack(side="left", padx=(0, T.PAD_SM))

            self._quality_label = ctk.CTkLabel(
                compress_quality_frame, textvariable=self._compress_quality_var, font=T.FONT_SM, width=30
            )
            self._quality_label.pack(side="left")
            compress_quality_frame.grid(row=1, column=1, sticky="w", padx=(T.PAD_MD, T.PAD_MD), pady=(T.PAD_XS, T.PAD_MD))

        elif op in {"protect", "unlock"}:
            action_word = "New" if op == "protect" else "Decrypting"
            ctk.CTkLabel(
                self._dynamic_frame, text=f"{action_word} Password", font=T.FONT_SM, text_color=T.TEXT_SECONDARY
            ).grid(row=0, column=0, sticky="w", padx=(T.PAD_MD, 0), pady=T.PAD_MD)
            self._crypto_password_entry = ctk.CTkEntry(
                self._dynamic_frame, placeholder_text="Password required", show="*", font=T.FONT_SM
            )
            self._crypto_password_entry.grid(row=0, column=1, sticky="ew", padx=(T.PAD_MD, T.PAD_MD), pady=T.PAD_MD)

        elif op == "watermark":
            ctk.CTkLabel(
                self._dynamic_frame, text="Watermark Text", font=T.FONT_SM, text_color=T.TEXT_SECONDARY
            ).grid(row=0, column=0, sticky="w", padx=(T.PAD_MD, 0), pady=(T.PAD_MD, T.PAD_XS))
            self._watermark_text_entry = ctk.CTkEntry(
                self._dynamic_frame, placeholder_text="e.g. CONFIDENTIAL", font=T.FONT_SM
            )
            self._watermark_text_entry.grid(row=0, column=1, sticky="ew", padx=(T.PAD_MD, T.PAD_MD), pady=(T.PAD_MD, T.PAD_XS))

            ctk.CTkLabel(
                self._dynamic_frame, text="Opacity", font=T.FONT_SM, text_color=T.TEXT_SECONDARY
            ).grid(row=1, column=0, sticky="w", padx=(T.PAD_MD, 0), pady=(T.PAD_XS, T.PAD_MD))

            self._opacity_var = tk.DoubleVar(value=0.15)
            opacity_slider = ctk.CTkSlider(
                self._dynamic_frame, from_=0.01, to=1.0, number_of_steps=100, variable=self._opacity_var
            )
            opacity_slider.grid(row=1, column=1, sticky="ew", padx=(T.PAD_MD, T.PAD_MD), pady=(T.PAD_XS, T.PAD_MD))

    def _parse_pages(self, raw_str: str) -> list[int]:
        if not raw_str.strip():
            raise ValueError("Page selection string cannot be empty.")
        parts = [p.strip() for p in raw_str.split(",") if p.strip()]
        pages: list[int] = []
        for part in parts:
            if "-" in part:
                start, end = part.split("-", 1)
                pages.extend(range(int(start.strip()), int(end.strip()) + 1))
            else:
                pages.append(int(part.strip()))
        return pages

    def _start_operation(self) -> None:
        self._result.hide()

        # Validate general inputs
        source_path_str = self._source_picker.get()
        if not source_path_str:
            self._result.show("Please select a source PDF file.", "error")
            return

        output_path_str = self._output_picker.get()
        if not output_path_str:
            self._result.show("Please choose an output file location.", "error")
            return

        source_path = Path(source_path_str)
        output_path = Path(output_path_str)

        # Enforce PDF extension
        if output_path.suffix.lower() != ".pdf":
            output_path = output_path.with_suffix(".pdf")
            self._output_picker.set(str(output_path))

        op = self._op_var.get()
        password = self._password_entry.get().strip() or None
        source_input = DocumentInput.from_path(source_path, password=password)

        # Operation specific parsing / validation
        args: tuple = ()
        if op == "delete":
            try:
                pages = self._parse_pages(self._delete_pages_entry.get())
                args = (pages,)
            except Exception as exc:
                self._result.show(f"Page range error: {exc}", "error")
                return

        elif op == "rotate":
            try:
                raw_pages = self._rotate_pages_entry.get().strip().lower()
                angle = int(self._rotate_angle_var.get())

                if raw_pages == "all" or not raw_pages:
                    # Let the service check, or we will query pdf page count.
                    # PyPDF lets us read it directly here
                    import pypdf
                    reader = pypdf.PdfReader(str(source_path))
                    if reader.is_encrypted and password:
                        reader.decrypt(password)
                    pages = list(range(1, len(reader.pages) + 1))
                else:
                    pages = self._parse_pages(raw_pages)

                operation = RotateOperation(pages=pages, angle=angle)
                args = (operation,)
            except Exception as exc:
                self._result.show(f"Rotation error: {exc}", "error")
                return

        elif op == "reorder":
            try:
                pages = self._parse_pages(self._reorder_entry.get())
                args = (pages,)
            except Exception as exc:
                self._result.show(f"Reorder list error: {exc}", "error")
                return

        elif op == "compress":
            raw_mode = self._compress_mode_var.get()
            mode = "smart" if "smart" in raw_mode.lower() else "rasterize"
            quality = int(self._compress_quality_var.get())
            compress_opt = CompressPdfOptions(
                source=source_input,
                output_path=output_path,
                mode=mode,
                quality=quality,
            )
            args = (compress_opt,)

        elif op in {"protect", "unlock"}:
            crypto_password = self._crypto_password_entry.get().strip()
            if not crypto_password:
                self._result.show("Password cannot be empty.", "error")
                return
            args = (crypto_password,)

        elif op == "watermark":
            text = self._watermark_text_entry.get().strip()
            if not text:
                self._result.show("Watermark text cannot be empty.", "error")
                return
            opacity = self._opacity_var.get()
            options = WatermarkOptions(text=text, opacity=opacity)
            args = (options,)

        # Disable button, show progress
        self._run_btn.configure(state="disabled")
        self._progress.show()
        self._progress.set_status(f"Executing {op} operation...")
        self._progress.set_progress(None)

        # Run in thread
        threading.Thread(
            target=self._run_op_thread,
            args=(op, source_input, output_path, args),
            daemon=True,
        ).start()

    def _run_op_thread(self, op: str, source: DocumentInput, output: Path, args: tuple) -> None:
        try:
            if op == "delete":
                res = self._pdf_service.delete_pages(source, output, args[0])
            elif op == "rotate":
                res = self._pdf_service.rotate_pages(source, output, args[0])
            elif op == "reorder":
                res = self._pdf_service.reorder_pages(source, output, args[0])
            elif op == "compress":
                res = self._pdf_service.compress_pdf(source, output, args[0])
            elif op == "protect":
                res = self._pdf_service.protect_pdf(source, output, args[0])
            elif op == "unlock":
                res = self._pdf_service.unlock_pdf(source, output, args[0])
            elif op == "watermark":
                res = self._pdf_service.watermark_pdf(source, output, args[0])
            else:
                raise ValueError(f"Unknown operation: {op}")

            self.after(0, self._on_success, res.message)
        except DocumentToolsError as exc:
            self.after(0, self._on_error, str(exc))
        except Exception as exc:
            self.after(0, self._on_error, f"An unexpected error occurred: {exc}")

    def _on_success(self, message: str) -> None:
        self._run_btn.configure(state="normal")
        self._progress.hide()
        self._result.show(message, "success")

    def _on_error(self, err_msg: str) -> None:
        self._run_btn.configure(state="normal")
        self._progress.hide()
        self._result.show(err_msg, "error")
