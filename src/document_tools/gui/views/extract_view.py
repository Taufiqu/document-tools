"""Extract View tab for extracting text and images from PDF/DOCX files."""
from __future__ import annotations

import threading
from pathlib import Path
import tkinter as tk
import customtkinter as ctk

from document_tools.features import ExtractImagesOptions, ExtractService, ExtractTextOptions
from document_tools.models import DocumentInput
from document_tools.exceptions import DocumentToolsError
from document_tools.gui import theme as T
from document_tools.gui.widgets import FilePicker, ResultCard, ProgressWidget


class ExtractView(ctk.CTkFrame):
    """
    ExtractView lets users extract:
      - Text from PDF/DOCX into a .txt file.
      - Images from PDF/DOCX into a directory.
    """

    def __init__(self, master: tk.Widget, **kwargs: object) -> None:
        super().__init__(master, fg_color="transparent", **kwargs)
        self._extract_service = ExtractService()

        # Title
        ctk.CTkLabel(
            self, text="Extract Text & Images", font=T.FONT_TITLE, text_color=T.TEXT_PRIMARY
        ).pack(anchor="w", pady=(0, T.PAD_MD))

        # Main scrollable content
        content = ctk.CTkScrollableFrame(self, fg_color="transparent", border_width=0)
        content.pack(fill="both", expand=True)

        # Mode Selection
        ctk.CTkLabel(
            content, text="Extraction Mode", font=T.FONT_LG, text_color=T.TEXT_PRIMARY
        ).pack(anchor="w", pady=(0, T.PAD_SM))

        self._mode_var = tk.StringVar(value="text")
        mode_selector = ctk.CTkSegmentedButton(
            content,
            values=["text", "images"],
            variable=self._mode_var,
            font=T.FONT_SM,
            command=self._on_mode_change,
        )
        mode_selector.pack(anchor="w", pady=(0, T.PAD_MD))

        # Source File Picker
        self._source_picker = FilePicker(
            content,
            label="Source File",
            mode="file",
            filetypes=[
                ("Supported formats", "*.pdf;*.docx"),
                ("PDF files", "*.pdf"),
                ("Word documents", "*.docx"),
            ],
            placeholder="Select PDF or DOCX file to extract from",
        )
        self._source_picker.pack(fill="x", pady=(0, T.PAD_MD))

        # Output Picker (will toggle between File and Dir based on mode)
        self._output_picker_container = ctk.CTkFrame(content, fg_color="transparent")
        self._output_picker_container.pack(fill="x", pady=T.PAD_MD)
        self._output_picker: FilePicker | None = None

        # Run Button
        self._run_btn = ctk.CTkButton(
            content,
            text="Extract",
            font=T.FONT_MD,
            height=40,
            command=self._start_extraction,
        )
        self._run_btn.pack(fill="x", pady=T.PAD_MD)

        # Progress & Results
        self._progress = ProgressWidget(content)
        self._progress.pack(fill="x")

        self._result = ResultCard(content)
        self._result.pack(fill="x")

        # Initialize correct output picker
        self._on_mode_change(self._mode_var.get())

    def _on_mode_change(self, mode: str) -> None:
        # Clear existing picker
        if self._output_picker:
            self._output_picker.pack_forget()
            self._output_picker.destroy()

        if mode == "text":
            self._output_picker = FilePicker(
                self._output_picker_container,
                label="Save Text File To",
                mode="file",
                filetypes=[("Text files", "*.txt")],
                placeholder="Choose output .txt file path",
            )
        else:
            self._output_picker = FilePicker(
                self._output_picker_container,
                label="Extract Images To Folder",
                mode="dir",
                placeholder="Choose folder where images will be saved",
            )

        self._output_picker.pack(fill="x")
        self._run_btn.configure(text=f"Extract {mode.capitalize()}")

    def _start_extraction(self) -> None:
        self._result.hide()

        # Validate inputs
        source_path_str = self._source_picker.get()
        if not source_path_str:
            self._result.show("Please select a source file.", "error")
            return

        output_str = self._output_picker.get() if self._output_picker else ""
        if not output_str:
            self._result.show("Please select an output destination.", "error")
            return

        source_path = Path(source_path_str)
        output_path = Path(output_str)
        mode = self._mode_var.get()

        self._run_btn.configure(state="disabled")
        self._progress.show()
        self._progress.set_status(f"Extracting {mode}...")
        self._progress.set_progress(None)

        if mode == "text":
            # Enforce .txt extension
            if output_path.suffix.lower() != ".txt":
                output_path = output_path.with_suffix(".txt")
                if self._output_picker:
                    self._output_picker.set(str(output_path))

            options = ExtractTextOptions(
                source=DocumentInput.from_path(source_path),
                output_path=output_path,
            )
            threading.Thread(
                target=self._run_extract_text_thread,
                args=(options,),
                daemon=True,
            ).start()
        else:
            options = ExtractImagesOptions(
                source=DocumentInput.from_path(source_path),
                output_dir=output_path,
            )
            threading.Thread(
                target=self._run_extract_images_thread,
                args=(options,),
                daemon=True,
            ).start()

    def _run_extract_text_thread(self, options: ExtractTextOptions) -> None:
        try:
            res = self._extract_service.extract_text(options)
            self.after(0, self._on_success, res.message)
        except DocumentToolsError as exc:
            self.after(0, self._on_error, str(exc))
        except Exception as exc:
            self.after(0, self._on_error, f"An unexpected error occurred: {exc}")

    def _run_extract_images_thread(self, options: ExtractImagesOptions) -> None:
        try:
            res = self._extract_service.extract_images(options)
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
