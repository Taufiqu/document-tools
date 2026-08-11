"""Convert View tab for converting between formats (PDF, DOCX, Markdown, XLSX, Images)."""
from __future__ import annotations

import threading
from pathlib import Path
import tkinter as tk
from tkinter import filedialog
import customtkinter as ctk

from document_tools.features import (
    ConvertOptions,
    ConvertService,
    FaviconOptions,
    ImagesToPdfOptions,
    PdfToImagesOptions,
)
from document_tools.models import DocumentInput, OutputFormat
from document_tools.exceptions import DocumentToolsError
from document_tools.gui import theme as T
from document_tools.gui.widgets import FilePicker, ResultCard, ProgressWidget


class ConvertView(ctk.CTkFrame):
    """
    ConvertView manages format conversions and favicon generation.
    It dynamically adjusts form inputs based on the selected conversion route.
    """

    def __init__(self, master: tk.Widget, **kwargs: object) -> None:
        super().__init__(master, fg_color="transparent", **kwargs)
        self._convert_service = ConvertService()

        # Title
        ctk.CTkLabel(
            self, text="Convert Documents", font=T.FONT_TITLE, text_color=T.TEXT_PRIMARY
        ).pack(anchor="w", pady=(0, T.PAD_MD))

        # Main scrollable content
        content = ctk.CTkScrollableFrame(self, fg_color="transparent", border_width=0)
        content.pack(fill="both", expand=True)

        # Route Selector
        ctk.CTkLabel(
            content, text="Select Conversion Route", font=T.FONT_LG, text_color=T.TEXT_PRIMARY
        ).pack(anchor="w", pady=(0, T.PAD_SM))

        self._route_var = tk.StringVar(value="PDF to DOCX")
        self._routes = [
            "PDF to DOCX",
            "DOCX to PDF",
            "PDF to Markdown",
            "DOCX to Markdown",
            "PDF to Excel (XLSX)",
            "Excel (XLSX) to PDF",
            "PDF to Images",
            "Images to PDF",
            "Image to Favicon (.ico / Web Pack)",
        ]
        self._route_selector = ctk.CTkOptionMenu(
            content,
            values=self._routes,
            variable=self._route_var,
            font=T.FONT_SM,
            command=self._on_route_change,
        )
        self._route_selector.pack(anchor="w", pady=(0, T.PAD_MD))

        # Dynamic Content Frame
        self._dynamic_frame = ctk.CTkFrame(content, fg_color="transparent")
        self._dynamic_frame.pack(fill="x", pady=(0, T.PAD_MD))

        # Run Button
        self._run_btn = ctk.CTkButton(
            content,
            text="Convert Document",
            font=T.FONT_MD,
            height=40,
            command=self._start_conversion,
        )
        self._run_btn.pack(fill="x", pady=T.PAD_MD)

        # Progress & Results
        self._progress = ProgressWidget(content)
        self._progress.pack(fill="x")

        self._result = ResultCard(content)
        self._result.pack(fill="x")

        # Initialize the view elements
        self._on_route_change(self._route_var.get())

    def _clear_dynamic_frame(self) -> None:
        for widget in self._dynamic_frame.winfo_children():
            widget.pack_forget()

    def _on_route_change(self, route: str) -> None:
        self._clear_dynamic_frame()

        if route == "Images to PDF":
            # Multi-image listbox and picker
            self._image_files: list[Path] = []
            list_frame = ctk.CTkFrame(self._dynamic_frame, fg_color=T.BG_CARD)
            list_frame.pack(fill="x", pady=(0, T.PAD_MD))

            listbox_frame = tk.Frame(list_frame, bg=T.BG_INPUT)
            listbox_frame.pack(side="left", fill="both", expand=True, padx=T.PAD_SM, pady=T.PAD_SM)

            self._image_listbox = tk.Listbox(
                listbox_frame,
                selectmode=tk.SINGLE,
                bg=T.BG_INPUT,
                fg=T.TEXT_PRIMARY,
                font=T.FONT_SM,
                selectbackground=T.ACCENT,
                selectforeground="#ffffff",
                bd=0,
                highlightthickness=0,
                activestyle="none",
            )
            self._image_listbox.pack(side="left", fill="both", expand=True)

            scrollbar = tk.Scrollbar(listbox_frame, orient="vertical", command=self._image_listbox.yview)
            scrollbar.pack(side="right", fill="y")
            self._image_listbox.config(yscrollcommand=scrollbar.set)

            btn_frame = ctk.CTkFrame(list_frame, fg_color="transparent")
            btn_frame.pack(side="right", fill="y", padx=T.PAD_SM, pady=T.PAD_SM)

            ctk.CTkButton(
                btn_frame, text="Add Images", width=90, font=T.FONT_SM, command=self._add_images
            ).pack(pady=T.PAD_XS)

            ctk.CTkButton(
                btn_frame, text="Remove", width=90, font=T.FONT_SM, fg_color=T.BG_HOVER, hover_color=T.ERROR, command=self._remove_image
            ).pack(pady=T.PAD_XS)

            ctk.CTkButton(
                btn_frame, text="Move Up", width=90, font=T.FONT_SM, fg_color=T.BG_HOVER, hover_color=T.ACCENT_DIM, command=self._move_image_up
            ).pack(pady=T.PAD_XS)

            ctk.CTkButton(
                btn_frame, text="Move Down", width=90, font=T.FONT_SM, fg_color=T.BG_HOVER, hover_color=T.ACCENT_DIM, command=self._move_image_down
            ).pack(pady=T.PAD_XS)

            # Output Picker
            self._output_picker = FilePicker(
                self._dynamic_frame,
                label="Save Output PDF To",
                mode="file",
                filetypes=[("PDF files", "*.pdf")],
                placeholder="Choose output PDF file location",
            )
            self._output_picker.pack(fill="x", pady=T.PAD_MD)

        elif route == "PDF to Images":
            # PDF source picker
            self._source_picker = FilePicker(
                self._dynamic_frame,
                label="Source PDF File",
                mode="file",
                filetypes=[("PDF files", "*.pdf")],
                placeholder="Select a PDF file",
            )
            self._source_picker.pack(fill="x", pady=(0, T.PAD_MD))

            # Settings card (Format, DPI)
            settings_frame = ctk.CTkFrame(self._dynamic_frame, fg_color=T.BG_CARD)
            settings_frame.pack(fill="x", pady=(0, T.PAD_MD))

            ctk.CTkLabel(
                settings_frame, text="Image Format", font=T.FONT_SM, text_color=T.TEXT_SECONDARY
            ).grid(row=0, column=0, sticky="w", padx=(T.PAD_MD, 0), pady=(T.PAD_MD, T.PAD_XS))
            self._img_format_var = tk.StringVar(value="png")
            img_format_selector = ctk.CTkSegmentedButton(
                settings_frame, values=["png", "jpg", "webp", "tiff"], variable=self._img_format_var, font=T.FONT_SM
            )
            img_format_selector.grid(row=0, column=1, sticky="w", padx=(T.PAD_MD, T.PAD_MD), pady=(T.PAD_MD, T.PAD_XS))

            ctk.CTkLabel(
                settings_frame, text="DPI", font=T.FONT_SM, text_color=T.TEXT_SECONDARY
            ).grid(row=1, column=0, sticky="w", padx=(T.PAD_MD, 0), pady=(T.PAD_XS, T.PAD_MD))
            self._dpi_var = tk.IntVar(value=150)
            self._dpi_label = ctk.CTkLabel(
                settings_frame, text="150 DPI", font=T.FONT_SM, text_color=T.TEXT_PRIMARY
            )
            self._dpi_label.grid(row=1, column=2, sticky="w", padx=(T.PAD_SM, T.PAD_MD), pady=(T.PAD_XS, T.PAD_MD))
            
            dpi_slider = ctk.CTkSlider(
                settings_frame,
                from_=72,
                to=300,
                number_of_steps=228,
                variable=self._dpi_var,
                command=lambda v: self._dpi_label.configure(text=f"{int(float(v))} DPI"),
            )
            dpi_slider.grid(row=1, column=1, sticky="ew", padx=(T.PAD_MD, T.PAD_MD), pady=(T.PAD_XS, T.PAD_MD))

            # Output Dir Picker
            self._output_picker = FilePicker(
                self._dynamic_frame,
                label="Save Images To Directory",
                mode="dir",
                placeholder="Choose folder where page images will be saved",
            )
            self._output_picker.pack(fill="x", pady=T.PAD_MD)

        elif route == "Image to Favicon (.ico / Web Pack)":
            self._source_picker = FilePicker(
                self._dynamic_frame,
                label="Source Image File (PNG / JPG / WEBP)",
                mode="file",
                filetypes=[("Image files", "*.png;*.jpg;*.jpeg;*.webp"), ("All files", "*.*")],
                placeholder="Select an image file (e.g. logo.png)",
            )
            self._source_picker.pack(fill="x", pady=(0, T.PAD_MD))

            settings_frame = ctk.CTkFrame(self._dynamic_frame, fg_color=T.BG_CARD)
            settings_frame.pack(fill="x", pady=(0, T.PAD_MD))

            self._webpack_var = tk.BooleanVar(value=True)
            webpack_chk = ctk.CTkCheckBox(
                settings_frame,
                text="Generate Web Favicon Pack (Apple Touch, Android Chrome, ICO & PNGs)",
                variable=self._webpack_var,
                font=T.FONT_SM,
            )
            webpack_chk.pack(anchor="w", padx=T.PAD_MD, pady=(T.PAD_SM, T.PAD_XS))

            self._html_var = tk.BooleanVar(value=True)
            html_chk = ctk.CTkCheckBox(
                settings_frame,
                text="Generate HTML tag snippet file (favicon_html.txt)",
                variable=self._html_var,
                font=T.FONT_SM,
            )
            html_chk.pack(anchor="w", padx=T.PAD_MD, pady=(T.PAD_XS, T.PAD_SM))

            self._output_picker = FilePicker(
                self._dynamic_frame,
                label="Save Favicons To Directory",
                mode="dir",
                placeholder="Choose folder where favicons will be saved",
            )
            self._output_picker.pack(fill="x", pady=T.PAD_MD)

        else:
            # Standard single-file to single-file conversions
            source_exts = {
                "PDF to DOCX": [("PDF files", "*.pdf")],
                "DOCX to PDF": [("Word documents", "*.docx")],
                "PDF to Markdown": [("PDF files", "*.pdf")],
                "DOCX to Markdown": [("Word documents", "*.docx")],
                "PDF to Excel (XLSX)": [("PDF files", "*.pdf")],
                "Excel (XLSX) to PDF": [("Excel files", "*.xlsx")],
            }[route]

            output_exts = {
                "PDF to DOCX": [("Word documents", "*.docx")],
                "DOCX to PDF": [("PDF files", "*.pdf")],
                "PDF to Markdown": [("Markdown files", "*.md")],
                "DOCX to Markdown": [("Markdown files", "*.md")],
                "PDF to Excel (XLSX)": [("Excel files", "*.xlsx")],
                "Excel (XLSX) to PDF": [("PDF files", "*.pdf")],
            }[route]

            self._source_picker = FilePicker(
                self._dynamic_frame,
                label="Source File",
                mode="file",
                filetypes=source_exts,
                placeholder="Select input file",
            )
            self._source_picker.pack(fill="x", pady=(0, T.PAD_MD))

            self._output_picker = FilePicker(
                self._dynamic_frame,
                label="Save Output To",
                mode="file",
                filetypes=output_exts,
                placeholder="Select output file location",
            )
            self._output_picker.pack(fill="x", pady=T.PAD_MD)

    def _add_images(self) -> None:
        filetypes = [
            ("Image files", "*.png;*.jpg;*.jpeg"),
            ("PNG files", "*.png"),
            ("JPEG files", "*.jpg;*.jpeg"),
            ("All files", "*.*"),
        ]
        paths = filedialog.askopenfilenames(filetypes=filetypes)
        if not paths:
            return

        for p in paths:
            path = Path(p)
            if path not in self._image_files:
                self._image_files.append(path)
                self._image_listbox.insert(tk.END, path.name)

    def _remove_image(self) -> None:
        selected = self._image_listbox.curselection()
        if not selected:
            return
        idx = selected[0]
        self._image_listbox.delete(idx)
        self._image_files.pop(idx)

    def _move_image_up(self) -> None:
        selected = self._image_listbox.curselection()
        if not selected:
            return
        idx = selected[0]
        if idx == 0:
            return
        self._image_files[idx], self._image_files[idx - 1] = self._image_files[idx - 1], self._image_files[idx]
        name = self._image_listbox.get(idx)
        self._image_listbox.delete(idx)
        self._image_listbox.insert(idx - 1, name)
        self._image_listbox.selection_set(idx - 1)

    def _move_image_down(self) -> None:
        selected = self._image_listbox.curselection()
        if not selected:
            return
        idx = selected[0]
        if idx == len(self._image_files) - 1:
            return
        self._image_files[idx], self._image_files[idx + 1] = self._image_files[idx + 1], self._image_files[idx]
        name = self._image_listbox.get(idx)
        self._image_listbox.delete(idx)
        self._image_listbox.insert(idx + 1, name)
        self._image_listbox.selection_set(idx + 1)

    def _start_conversion(self) -> None:
        self._result.hide()
        route = self._route_var.get()

        # Output location check
        output_str = self._output_picker.get()
        if not output_str:
            self._result.show("Please select an output destination.", "error")
            return
        output_path = Path(output_str)

        # Build options or execute depending on route
        if route == "Images to PDF":
            if not self._image_files:
                self._result.show("Please add at least one image to combine.", "error")
                return
            if output_path.suffix.lower() != ".pdf":
                output_path = output_path.with_suffix(".pdf")
                self._output_picker.set(str(output_path))

            sources = [DocumentInput.from_path(p) for p in self._image_files]
            options = ImagesToPdfOptions(sources=sources, output_path=output_path)

            self._run_btn.configure(state="disabled")
            self._progress.show()
            self._progress.set_status("Combining images to PDF...")
            self._progress.set_progress(None)

            threading.Thread(
                target=self._run_images_to_pdf_thread,
                args=(options,),
                daemon=True,
            ).start()

        elif route == "PDF to Images":
            source_str = self._source_picker.get()
            if not source_str:
                self._result.show("Please select a source PDF file.", "error")
                return
            source_path = Path(source_str)

            dpi = int(self._dpi_var.get())
            fmt = self._img_format_var.get()
            options = PdfToImagesOptions(
                source=DocumentInput.from_path(source_path),
                output_dir=output_path,
                image_format=fmt,
                dpi=dpi,
            )

            self._run_btn.configure(state="disabled")
            self._progress.show()
            self._progress.set_status("Converting PDF to page images...")
            self._progress.set_progress(None)

            threading.Thread(
                target=self._run_pdf_to_images_thread,
                args=(options,),
                daemon=True,
            ).start()

        elif route == "Image to Favicon (.ico / Web Pack)":
            source_str = self._source_picker.get()
            if not source_str:
                self._result.show("Please select a source image file.", "error")
                return
            source_path = Path(source_str)
            web_pack = self._webpack_var.get()
            generate_html = self._html_var.get()

            options = FaviconOptions(
                source=DocumentInput.from_path(source_path),
                output_dir=output_path,
                web_pack=web_pack,
                generate_html=generate_html,
            )

            self._run_btn.configure(state="disabled")
            self._progress.show()
            self._progress.set_status("Generating favicon and web icon bundle...")
            self._progress.set_progress(None)

            threading.Thread(
                target=self._run_favicon_thread,
                args=(options,),
                daemon=True,
            ).start()

        else:
            # Standard conversion
            source_str = self._source_picker.get()
            if not source_str:
                self._result.show("Please select a source file.", "error")
                return
            source_path = Path(source_str)

            out_fmt = {
                "PDF to DOCX": OutputFormat.DOCX,
                "DOCX to PDF": OutputFormat.PDF,
                "PDF to Markdown": OutputFormat.MARKDOWN,
                "DOCX to Markdown": OutputFormat.MARKDOWN,
                "PDF to Excel (XLSX)": OutputFormat.XLSX,
                "Excel (XLSX) to PDF": OutputFormat.PDF,
            }[route]

            # Enforce output extension
            ext = out_fmt.value
            if output_path.suffix.lower().lstrip(".") != ext:
                output_path = output_path.with_suffix(f".{ext}")
                self._output_picker.set(str(output_path))

            options = ConvertOptions(
                source=DocumentInput.from_path(source_path),
                output_path=output_path,
                output_format=out_fmt,
            )

            self._run_btn.configure(state="disabled")
            self._progress.show()
            self._progress.set_status(f"Converting file to {out_fmt.value.upper()}...")
            self._progress.set_progress(None)

            threading.Thread(
                target=self._run_convert_thread,
                args=(options,),
                daemon=True,
            ).start()

    def _run_convert_thread(self, options: ConvertOptions) -> None:
        try:
            res = self._convert_service.convert(options)
            self.after(0, self._on_success, res.message)
        except DocumentToolsError as exc:
            self.after(0, self._on_error, str(exc))
        except Exception as exc:
            self.after(0, self._on_error, f"An unexpected error occurred: {exc}")

    def _run_images_to_pdf_thread(self, options: ImagesToPdfOptions) -> None:
        try:
            res = self._convert_service.images_to_pdf(options)
            self.after(0, self._on_success, res.message)
        except DocumentToolsError as exc:
            self.after(0, self._on_error, str(exc))
        except Exception as exc:
            self.after(0, self._on_error, f"An unexpected error occurred: {exc}")

    def _run_pdf_to_images_thread(self, options: PdfToImagesOptions) -> None:
        try:
            res = self._convert_service.pdf_to_images(options)
            self.after(0, self._on_success, res.message)
        except DocumentToolsError as exc:
            self.after(0, self._on_error, str(exc))
        except Exception as exc:
            self.after(0, self._on_error, f"An unexpected error occurred: {exc}")

    def _run_favicon_thread(self, options: FaviconOptions) -> None:
        try:
            res = self._convert_service.generate_favicon(options)
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
