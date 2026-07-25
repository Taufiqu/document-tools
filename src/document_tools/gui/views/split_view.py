"""Split View tab for splitting PDF and DOCX files."""
from __future__ import annotations

import re
import threading
from pathlib import Path
import tkinter as tk
import customtkinter as ctk

from document_tools.features import SplitMode, SplitOptions, SplitService
from document_tools.models import DocumentInput, PageRange
from document_tools.exceptions import DocumentToolsError
from document_tools.gui import theme as T
from document_tools.gui.widgets import FilePicker, ResultCard, ProgressWidget


class SplitView(ctk.CTkFrame):
    """
    Split View lets the user split a single PDF or DOCX file.
    Modes:
      - Single pages (PDF only)
      - Page ranges (PDF only)
      - Section breaks (DOCX only)
    """

    def __init__(self, master: tk.Widget, **kwargs: object) -> None:
        super().__init__(master, fg_color="transparent", **kwargs)
        self._split_service = SplitService()

        # Title
        ctk.CTkLabel(
            self, text="Split Document", font=T.FONT_TITLE, text_color=T.TEXT_PRIMARY
        ).pack(anchor="w", pady=(0, T.PAD_MD))

        # Main scrollable content
        content = ctk.CTkScrollableFrame(self, fg_color="transparent", border_width=0)
        content.pack(fill="both", expand=True)

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
            on_change=self._on_source_change,
            placeholder="Select a PDF or DOCX file to split",
        )
        self._source_picker.pack(fill="x", pady=(0, T.PAD_MD))

        # Optional Password field
        self._password_frame = ctk.CTkFrame(content, fg_color="transparent")
        ctk.CTkLabel(
            self._password_frame, text="Password (if encrypted PDF)", font=T.FONT_SM, text_color=T.TEXT_SECONDARY
        ).pack(side="left", padx=(0, T.PAD_MD))
        self._password_entry = ctk.CTkEntry(
            self._password_frame,
            placeholder_text="Optional",
            show="*",
            font=T.FONT_SM,
            width=150,
        )
        self._password_entry.pack(side="left")
        self._password_frame.pack(anchor="w", pady=(0, T.PAD_MD))

        # Split Settings Section
        ctk.CTkLabel(
            content, text="Split Settings", font=T.FONT_LG, text_color=T.TEXT_PRIMARY
        ).pack(anchor="w", pady=(T.PAD_SM, T.PAD_SM))

        settings_frame = ctk.CTkFrame(content, fg_color=T.BG_CARD)
        settings_frame.pack(fill="x", pady=(0, T.PAD_MD))

        # Split Mode Selection
        self._mode_label = ctk.CTkLabel(
            settings_frame, text="Split Mode", font=T.FONT_SM, text_color=T.TEXT_SECONDARY
        )
        self._mode_label.grid(row=0, column=0, sticky="w", padx=(T.PAD_MD, 0), pady=(T.PAD_MD, T.PAD_MD))

        self._mode_var = tk.StringVar(value=SplitMode.SINGLE_PAGES.value)
        self._mode_selector = ctk.CTkOptionMenu(
            settings_frame,
            values=[SplitMode.SINGLE_PAGES.value, SplitMode.PAGE_RANGES.value, SplitMode.SECTION_BREAKS.value],
            variable=self._mode_var,
            font=T.FONT_SM,
            command=self._on_mode_change,
        )
        self._mode_selector.grid(row=0, column=1, sticky="w", padx=(T.PAD_MD, T.PAD_MD), pady=(T.PAD_MD, T.PAD_MD))

        # Page Ranges input field (only shown for PAGE_RANGES mode)
        self._ranges_label = ctk.CTkLabel(
            settings_frame, text="Page Ranges", font=T.FONT_SM, text_color=T.TEXT_SECONDARY
        )
        self._ranges_entry = ctk.CTkEntry(
            settings_frame,
            placeholder_text="e.g. 1-3, 5, 8-10",
            font=T.FONT_SM,
            width=250,
        )

        # Output Folder Picker
        self._output_picker = FilePicker(
            content,
            label="Save Output To Directory",
            mode="dir",
            placeholder="Choose folder where split parts will be saved",
        )
        self._output_picker.pack(fill="x", pady=T.PAD_MD)

        # Run Button
        self._run_btn = ctk.CTkButton(
            content,
            text="Split Document",
            font=T.FONT_MD,
            height=40,
            command=self._start_split,
        )
        self._run_btn.pack(fill="x", pady=T.PAD_MD)

        # Progress & Results
        self._progress = ProgressWidget(content)
        self._progress.pack(fill="x")

        self._result = ResultCard(content)
        self._result.pack(fill="x")

        # Initial layout update
        self._on_mode_change(self._mode_var.get())

    def _on_source_change(self, value: str | list[str]) -> None:
        if not value:
            return
        path_str = value if isinstance(value, str) else value[0]
        suffix = Path(path_str).suffix.lower()

        # Update modes dropdown based on file format
        if suffix == ".docx":
            self._mode_var.set(SplitMode.SECTION_BREAKS.value)
            self._mode_selector.configure(state="disabled")
            self._password_frame.pack_forget()
        else:
            self._mode_selector.configure(state="normal")
            self._password_frame.pack(anchor="w", pady=(0, T.PAD_MD))

        self._on_mode_change(self._mode_var.get())

    def _on_mode_change(self, mode: str) -> None:
        if mode == SplitMode.PAGE_RANGES.value:
            self._mode_label.grid(row=0, column=0, sticky="w", padx=(T.PAD_MD, 0), pady=(T.PAD_MD, T.PAD_XS))
            self._mode_selector.grid(row=0, column=1, sticky="w", padx=(T.PAD_MD, T.PAD_MD), pady=(T.PAD_MD, T.PAD_XS))
            self._ranges_label.grid(row=1, column=0, sticky="w", padx=(T.PAD_MD, 0), pady=(T.PAD_XS, T.PAD_MD))
            self._ranges_entry.grid(row=1, column=1, sticky="w", padx=(T.PAD_MD, T.PAD_MD), pady=(T.PAD_XS, T.PAD_MD))
        else:
            self._mode_label.grid(row=0, column=0, sticky="w", padx=(T.PAD_MD, 0), pady=(T.PAD_MD, T.PAD_MD))
            self._mode_selector.grid(row=0, column=1, sticky="w", padx=(T.PAD_MD, T.PAD_MD), pady=(T.PAD_MD, T.PAD_MD))
            self._ranges_label.grid_forget()
            self._ranges_entry.grid_forget()

    def _parse_ranges(self, raw_str: str) -> list[PageRange]:
        if not raw_str.strip():
            raise ValueError("Page range input cannot be empty.")

        # Accept formats like "1-3, 5, 8-10" or "1 - 3, 5"
        parts = [p.strip() for p in raw_str.split(",") if p.strip()]
        ranges: list[PageRange] = []

        for part in parts:
            # Match start-end
            match = re.match(r"^(\d+)\s*-\s*(\d+)$", part)
            if match:
                start = int(match.group(1))
                end = int(match.group(2))
                ranges.append(PageRange(start=start, end=end))
            # Match single page
            elif re.match(r"^(\d+)$", part):
                page = int(part)
                ranges.append(PageRange(start=page, end=page))
            else:
                raise ValueError(f"Invalid range format: '{part}'. Use formats like '1-3' or '5'.")

        return ranges

    def _start_split(self) -> None:
        self._result.hide()

        # Validate UI inputs
        source_path_str = self._source_picker.get()
        if not source_path_str:
            self._result.show("Please select a source file to split.", "error")
            return

        output_dir_str = self._output_picker.get()
        if not output_dir_str:
            self._result.show("Please choose an output directory.", "error")
            return

        source_path = Path(source_path_str)
        output_dir = Path(output_dir_str)
        mode = SplitMode(self._mode_var.get())

        # Validate range input if PAGE_RANGES mode is selected
        ranges: list[PageRange] = []
        if mode == SplitMode.PAGE_RANGES:
            try:
                ranges = self._parse_ranges(self._ranges_entry.get())
            except Exception as exc:
                self._result.show(f"Page range error: {exc}", "error")
                return

        # Disable button, show progress
        self._run_btn.configure(state="disabled")
        self._progress.show()
        self._progress.set_status("Splitting document...")
        self._progress.set_progress(None)  # pulse

        # Run in thread
        password = self._password_entry.get().strip() or None
        source_input = DocumentInput.from_path(source_path, password=password)
        options = SplitOptions(
            source=source_input,
            output_dir=output_dir,
            mode=mode,
            ranges=ranges,
        )

        threading.Thread(
            target=self._run_split_thread,
            args=(options,),
            daemon=True,
        ).start()

    def _run_split_thread(self, options: SplitOptions) -> None:
        try:
            res = self._split_service.split(options)
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
