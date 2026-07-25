"""Progress bar and status label widget."""
from __future__ import annotations

import tkinter as tk
import customtkinter as ctk

from document_tools.gui import theme as T


class ProgressWidget(ctk.CTkFrame):
    """
    A widget containing a progress bar and a status text label.
    """

    def __init__(self, master: tk.Widget, **kwargs: object) -> None:
        super().__init__(master, fg_color="transparent", **kwargs)

        self._status_var = tk.StringVar(value="")
        self._status_label = ctk.CTkLabel(
            self,
            textvariable=self._status_var,
            font=T.FONT_SM,
            text_color=T.TEXT_SECONDARY,
            anchor="w",
            justify="left",
        )
        self._status_label.pack(fill="x", pady=(0, T.PAD_XS))

        self._progress_bar = ctk.CTkProgressBar(self)
        self._progress_bar.pack(fill="x")
        self._progress_bar.set(0.0)

        # Hide initially
        self.pack_forget()

    def set_status(self, text: str) -> None:
        """Update status label text."""
        self._status_var.set(text)

    def set_progress(self, value: float) -> None:
        """
        Set progress bar value.
        value: float between 0.0 and 1.0, or None for indeterminate/pulse
        """
        if value is None:
            self._progress_bar.configure(mode="indeterminate")
            self._progress_bar.start()
        else:
            self._progress_bar.configure(mode="determinate")
            self._progress_bar.stop()
            self._progress_bar.set(max(0.0, min(1.0, value)))

    def reset(self) -> None:
        """Reset status and progress."""
        self._status_var.set("")
        self._progress_bar.stop()
        self._progress_bar.set(0.0)

    def show(self) -> None:
        """Show the progress widget."""
        self.pack(fill="x", pady=(T.PAD_MD, 0))

    def hide(self) -> None:
        """Hide the progress widget and reset it."""
        self.reset()
        self.pack_forget()
