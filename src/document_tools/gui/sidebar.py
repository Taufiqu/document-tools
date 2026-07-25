"""Sidebar navigation panel widget."""
from __future__ import annotations

import tkinter as tk
from typing import Callable

import customtkinter as ctk

from document_tools.gui import theme as T


class Sidebar(ctk.CTkFrame):
    """
    Left-hand sidebar navigation panel containing the application logo/title
    and buttons to switch between different tool categories.
    """

    def __init__(
        self,
        master: tk.Widget,
        on_view_change: Callable[[str], None],
        **kwargs: object,
    ) -> None:
        super().__init__(
            master,
            width=T.SIDEBAR_WIDTH,
            fg_color=T.BG_SIDEBAR,
            border_color=T.BORDER,
            border_width=1,
            corner_radius=0,
            **kwargs,
        )
        self.pack_propagate(False)  # maintain fixed width
        self._on_view_change = on_view_change

        # App Title / Logo
        title_label = ctk.CTkLabel(
            self,
            text="🛠️ DocTools",
            font=T.FONT_XL,
            text_color=T.TEXT_PRIMARY,
        )
        title_label.pack(pady=(T.PAD_LG, T.PAD_XL), padx=T.PAD_MD, anchor="w")

        # Nav Buttons Definition
        self._nav_items = [
            ("merge", "📄 Merge"),
            ("split", "✂️ Split"),
            ("pdf_utils", "🔧 PDF Utils"),
            ("convert", "🔄 Convert"),
            ("extract", "📤 Extract"),
        ]
        self._buttons: dict[str, ctk.CTkButton] = {}

        # Build buttons
        for view_id, label in self._nav_items:
            btn = ctk.CTkButton(
                self,
                text=label,
                anchor="w",
                font=T.FONT_MD,
                height=38,
                fg_color="transparent",
                text_color=T.TEXT_SECONDARY,
                hover_color=T.BG_HOVER,
                corner_radius=6,
                command=lambda v=view_id: self._select_view(v),
            )
            btn.pack(fill="x", padx=T.PAD_SM, pady=T.PAD_XS)
            self._buttons[view_id] = btn

        # Select the first view by default
        self._active_view: str | None = None
        self._select_view(self._nav_items[0][0])

    def _select_view(self, view_id: str) -> None:
        if self._active_view == view_id:
            return

        # Reset old active button styling
        if self._active_view and self._active_view in self._buttons:
            self._buttons[self._active_view].configure(
                fg_color="transparent",
                text_color=T.TEXT_SECONDARY,
            )

        # Apply new active button styling
        self._active_view = view_id
        if view_id in self._buttons:
            self._buttons[view_id].configure(
                fg_color=T.BG_SELECTED,
                text_color=T.TEXT_PRIMARY,
            )

        # Notify parent
        self._on_view_change(view_id)
