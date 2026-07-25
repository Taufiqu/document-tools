"""Merge View tab for merging multiple PDF and DOCX files."""
from __future__ import annotations

import threading
from pathlib import Path
import tkinter as tk
from tkinter import filedialog
import customtkinter as ctk

from document_tools.features import MergeOptions, MergeService
from document_tools.models import DocumentInput, OutputFormat
from document_tools.exceptions import DocumentToolsError
from document_tools.gui import theme as T
from document_tools.gui.widgets import FilePicker, ResultCard, ProgressWidget


class MergeView(ctk.CTkFrame):
    """
    Merge View lets the user pick multiple PDF/DOCX files,
    reorder them, and merge them into a single PDF or DOCX file.
    """

    def __init__(self, master: tk.Widget, **kwargs: object) -> None:
        super().__init__(master, fg_color="transparent", **kwargs)
        self._merge_service = MergeService()
        self._files: list[Path] = []

        # Title
        ctk.CTkLabel(
            self, text="Merge Documents", font=T.FONT_TITLE, text_color=T.TEXT_PRIMARY
        ).pack(anchor="w", pady=(0, T.PAD_MD))

        # Main scrollable content
        content = ctk.CTkScrollableFrame(self, fg_color="transparent", border_width=0)
        content.pack(fill="both", expand=True)

        # File List Section
        ctk.CTkLabel(
            content, text="Files to Merge (in order)", font=T.FONT_LG, text_color=T.TEXT_PRIMARY
        ).pack(anchor="w", pady=(0, T.PAD_SM))

        list_frame = ctk.CTkFrame(content, fg_color=T.BG_CARD)
        list_frame.pack(fill="x", pady=(0, T.PAD_MD))

        # We will use a standard Listbox wrapped in CTk for multi-selection/reordering simplicity
        listbox_frame = tk.Frame(list_frame, bg=T.BG_INPUT)
        listbox_frame.pack(side="left", fill="both", expand=True, padx=T.PAD_SM, pady=T.PAD_SM)

        self._listbox = tk.Listbox(
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
        self._listbox.pack(side="left", fill="both", expand=True)

        scrollbar = tk.Scrollbar(listbox_frame, orient="vertical", command=self._listbox.yview)
        scrollbar.pack(side="right", fill="y")
        self._listbox.config(yscrollcommand=scrollbar.set)

        # List control buttons (Right side of Listbox)
        btn_frame = ctk.CTkFrame(list_frame, fg_color="transparent")
        btn_frame.pack(side="right", fill="y", padx=T.PAD_SM, pady=T.PAD_SM)

        ctk.CTkButton(
            btn_frame, text="Add Files", width=90, font=T.FONT_SM, command=self._add_files
        ).pack(pady=T.PAD_XS)

        ctk.CTkButton(
            btn_frame, text="Remove", width=90, font=T.FONT_SM, fg_color=T.BG_HOVER, hover_color=T.ERROR, command=self._remove_file
        ).pack(pady=T.PAD_XS)

        ctk.CTkButton(
            btn_frame, text="Move Up", width=90, font=T.FONT_SM, fg_color=T.BG_HOVER, hover_color=T.ACCENT_DIM, command=self._move_up
        ).pack(pady=T.PAD_XS)

        ctk.CTkButton(
            btn_frame, text="Move Down", width=90, font=T.FONT_SM, fg_color=T.BG_HOVER, hover_color=T.ACCENT_DIM, command=self._move_down
        ).pack(pady=T.PAD_XS)

        ctk.CTkButton(
            btn_frame, text="Clear", width=90, font=T.FONT_SM, fg_color=T.BG_HOVER, hover_color=T.ERROR, command=self._clear_files
        ).pack(pady=T.PAD_XS)

        # Options Section
        ctk.CTkLabel(
            content, text="Merge Settings", font=T.FONT_LG, text_color=T.TEXT_PRIMARY
        ).pack(anchor="w", pady=(T.PAD_MD, T.PAD_SM))

        settings_frame = ctk.CTkFrame(content, fg_color=T.BG_CARD)
        settings_frame.pack(fill="x", pady=(0, T.PAD_MD))

        # Format Selector
        ctk.CTkLabel(
            settings_frame, text="Output Format", font=T.FONT_SM, text_color=T.TEXT_SECONDARY
        ).grid(row=0, column=0, sticky="w", padx=(T.PAD_MD, 0), pady=(T.PAD_MD, T.PAD_XS))

        self._format_var = tk.StringVar(value="pdf")
        format_selector = ctk.CTkSegmentedButton(
            settings_frame,
            values=["pdf", "docx"],
            variable=self._format_var,
            font=T.FONT_SM,
        )
        format_selector.grid(row=0, column=1, sticky="w", padx=(T.PAD_MD, T.PAD_MD), pady=(T.PAD_MD, T.PAD_XS))

        # Optional Password field
        ctk.CTkLabel(
            settings_frame, text="Password (if encrypted)", font=T.FONT_SM, text_color=T.TEXT_SECONDARY
        ).grid(row=1, column=0, sticky="w", padx=(T.PAD_MD, 0), pady=(T.PAD_XS, T.PAD_MD))

        self._password_entry = ctk.CTkEntry(
            settings_frame,
            placeholder_text="Optional",
            show="*",
            font=T.FONT_SM,
            width=200,
        )
        self._password_entry.grid(row=1, column=1, sticky="w", padx=(T.PAD_MD, T.PAD_MD), pady=(T.PAD_XS, T.PAD_MD))

        # Output Picker
        self._output_picker = FilePicker(
            content,
            label="Save Output To",
            mode="file",
            placeholder="Choose output file location",
        )
        self._output_picker.pack(fill="x", pady=T.PAD_MD)

        # Run Button
        self._run_btn = ctk.CTkButton(
            content,
            text="Merge Documents",
            font=T.FONT_MD,
            height=40,
            command=self._start_merge,
        )
        self._run_btn.pack(fill="x", pady=T.PAD_MD)

        # Progress & Results
        self._progress = ProgressWidget(content)
        self._progress.pack(fill="x")

        self._result = ResultCard(content)
        self._result.pack(fill="x")

    def _add_files(self) -> None:
        filetypes = [
            ("Supported formats", "*.pdf;*.docx"),
            ("PDF files", "*.pdf"),
            ("Word documents", "*.docx"),
            ("All files", "*.*"),
        ]
        paths = filedialog.askopenfilenames(filetypes=filetypes)
        if not paths:
            return

        for p in paths:
            path = Path(p)
            if path not in self._files:
                self._files.append(path)
                self._listbox.insert(tk.END, path.name)

    def _remove_file(self) -> None:
        selected = self._listbox.curselection()
        if not selected:
            return
        idx = selected[0]
        self._listbox.delete(idx)
        self._files.pop(idx)

    def _move_up(self) -> None:
        selected = self._listbox.curselection()
        if not selected:
            return
        idx = selected[0]
        if idx == 0:
            return
        # Swap in list
        self._files[idx], self._files[idx - 1] = self._files[idx - 1], self._files[idx]
        # Swap in listbox
        name = self._listbox.get(idx)
        self._listbox.delete(idx)
        self._listbox.insert(idx - 1, name)
        self._listbox.selection_set(idx - 1)

    def _move_down(self) -> None:
        selected = self._listbox.curselection()
        if not selected:
            return
        idx = selected[0]
        if idx == len(self._files) - 1:
            return
        # Swap in list
        self._files[idx], self._files[idx + 1] = self._files[idx + 1], self._files[idx]
        # Swap in listbox
        name = self._listbox.get(idx)
        self._listbox.delete(idx)
        self._listbox.insert(idx + 1, name)
        self._listbox.selection_set(idx + 1)

    def _clear_files(self) -> None:
        self._files.clear()
        self._listbox.delete(0, tk.END)

    def _start_merge(self) -> None:
        self._result.hide()

        # Validate UI inputs
        if not self._files:
            self._result.show("Please add at least one file to merge.", "error")
            return

        output_path_str = self._output_picker.get()
        if not output_path_str:
            self._result.show("Please choose an output file location.", "error")
            return

        output_path = Path(output_path_str)
        out_fmt = OutputFormat(self._format_var.get())

        # Ensure correct file extension for output
        if output_path.suffix.lower().lstrip(".") != out_fmt.value:
            output_path = output_path.with_suffix(f".{out_fmt.value}")
            self._output_picker.set(str(output_path))

        # Disable button, show progress
        self._run_btn.configure(state="disabled")
        self._progress.show()
        self._progress.set_status("Merging documents...")
        self._progress.set_progress(None)  # pulse animation

        # Run in thread
        password = self._password_entry.get().strip() or None
        inputs = [DocumentInput.from_path(p, password=password) for p in self._files]
        options = MergeOptions(
            inputs=inputs,
            output_path=output_path,
            output_format=out_fmt,
        )

        threading.Thread(
            target=self._run_merge_thread,
            args=(options,),
            daemon=True,
        ).start()

    def _run_merge_thread(self, options: MergeOptions) -> None:
        try:
            res = self._merge_service.merge(options)
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
