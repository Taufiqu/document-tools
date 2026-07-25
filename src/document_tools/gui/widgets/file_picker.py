"""Reusable file picker widget with drag-and-drop support (falls back to dialog)."""
from __future__ import annotations

import tkinter as tk
from pathlib import Path
from tkinter import filedialog
from typing import Callable

import customtkinter as ctk

from document_tools.gui import theme as T


class FilePicker(ctk.CTkFrame):
    """
    A labelled file-picker row.

    Args:
        master:       Parent widget.
        label:        Label shown above the entry.
        mode:         "file" (pick a single file) | "files" (pick multiple) | "dir" (pick a folder).
        filetypes:    List of (label, pattern) tuples passed to filedialog.
        on_change:    Callback called with the selected path(s) when selection changes.
        placeholder:  Grey hint text shown inside the entry when empty.
    """

    def __init__(
        self,
        master: tk.Widget,
        label: str,
        mode: str = "file",
        filetypes: list[tuple[str, str]] | None = None,
        on_change: Callable[[str | list[str]], None] | None = None,
        placeholder: str = "",
        **kwargs: object,
    ) -> None:
        super().__init__(master, fg_color="transparent", **kwargs)
        self._mode = mode
        self._filetypes = filetypes or [("All files", "*.*")]
        self._on_change = on_change

        # Label
        ctk.CTkLabel(self, text=label, font=T.FONT_SM, text_color=T.TEXT_SECONDARY).pack(
            anchor="w", pady=(0, T.PAD_XS)
        )

        # Row: entry + browse button
        row = ctk.CTkFrame(self, fg_color="transparent")
        row.pack(fill="x")
        row.columnconfigure(0, weight=1)

        self._var = tk.StringVar()
        self._entry = ctk.CTkEntry(
            row,
            textvariable=self._var,
            placeholder_text=placeholder or ("Click Browse or drag file(s) here" if mode != "dir" else "Click Browse or drag folder here"),
            font=T.FONT_SM,
            fg_color=T.BG_INPUT,
            border_color=T.BORDER,
            text_color=T.TEXT_PRIMARY,
        )
        self._entry.grid(row=0, column=0, sticky="ew", padx=(0, T.PAD_SM))

        ctk.CTkButton(
            row,
            text="Browse",
            width=80,
            height=34,
            font=T.FONT_SM,
            fg_color=T.BG_HOVER,
            hover_color=T.ACCENT_DIM,
            command=self._browse,
        ).grid(row=0, column=1)

        # Enable drop target if tkinterdnd2 is available
        self._try_enable_dnd()

    # ------------------------------------------------------------------ #

    def _browse(self) -> None:
        if self._mode == "dir":
            path = filedialog.askdirectory()
            if path:
                self._set_value(path)
        elif self._mode == "files":
            paths = filedialog.askopenfilenames(filetypes=self._filetypes)
            if paths:
                joined = ";".join(paths)
                self._set_value(joined)
        else:
            path = filedialog.askopenfilename(filetypes=self._filetypes)
            if path:
                self._set_value(path)

    def _set_value(self, value: str) -> None:
        self._var.set(value)
        if self._on_change:
            if self._mode == "files":
                self._on_change(value.split(";"))
            else:
                self._on_change(value)

    def _try_enable_dnd(self) -> None:
        try:
            self._entry.drop_target_register("DND_Files")  # type: ignore[attr-defined]
            self._entry.dnd_bind("<<Drop>>", self._on_drop)  # type: ignore[attr-defined]
        except (AttributeError, tk.TclError):
            pass  # tkinterdnd2 not available or not loaded — silently skip

    def _on_drop(self, event: object) -> None:
        raw: str = getattr(event, "data", "")
        # tkinterdnd2 wraps paths with braces when they contain spaces
        paths = [p.strip("{}") for p in raw.split() if p]
        if not paths:
            return
        if self._mode == "files":
            self._set_value(";".join(paths))
        else:
            self._set_value(paths[0])

    # ------------------------------------------------------------------ #
    # Public API                                                           #
    # ------------------------------------------------------------------ #

    def get(self) -> str:
        return self._var.get().strip()

    def get_paths(self) -> list[Path]:
        raw = self.get()
        if not raw:
            return []
        return [Path(p) for p in raw.split(";") if p]

    def set(self, value: str) -> None:
        self._var.set(value)

    def clear(self) -> None:
        self._var.set("")
