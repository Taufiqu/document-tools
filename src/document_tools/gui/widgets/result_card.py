"""Result card widget to display success, error, or warning status messages."""
from __future__ import annotations

import tkinter as tk
import customtkinter as ctk

from document_tools.gui import theme as T


class ResultCard(ctk.CTkFrame):
    """
    A card showing operation results (Success/Error/Warning) with appropriate colors.
    """

    def __init__(self, master: tk.Widget, **kwargs: object) -> None:
        super().__init__(master, **kwargs)
        self.grid_columnconfigure(0, weight=1)

        # We will dynamically create elements on show, and pack/unpack them
        self._message_var = tk.StringVar()
        
        # Message label
        self._label = ctk.CTkLabel(
            self,
            textvariable=self._message_var,
            font=T.FONT_SM,
            wraplength=500,
            justify="left",
            anchor="w",
        )
        self._label.pack(fill="x", padx=T.PAD_MD, pady=T.PAD_MD)

        # Hide initially
        self.pack_forget()

    def show(self, message: str, status: str = "success") -> None:
        """
        Show the result card with a message.
        status: "success" | "error" | "warning"
        """
        self._message_var.set(message)

        if status == "success":
            self.configure(
                fg_color=T.SUCCESS_BG,
                border_color=T.SUCCESS,
                border_width=1,
            )
            self._label.configure(text_color=T.SUCCESS)
        elif status == "error":
            self.configure(
                fg_color=T.ERROR_BG,
                border_color=T.ERROR,
                border_width=1,
            )
            self._label.configure(text_color=T.ERROR)
        else:  # warning
            self.configure(
                fg_color=T.WARNING_BG,
                border_color=T.WARNING,
                border_width=1,
            )
            self._label.configure(text_color=T.WARNING)

        self.pack(fill="x", pady=(T.PAD_MD, 0))

    def hide(self) -> None:
        """Hide the result card."""
        self.pack_forget()
