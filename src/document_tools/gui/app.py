"""Main application window using CustomTkinter."""
from __future__ import annotations

import sys
import tkinter as tk
import customtkinter as ctk

from document_tools.gui import theme as T
from document_tools.gui.sidebar import Sidebar
from document_tools.gui.views import MergeView, SplitView, PdfUtilsView, ConvertView, ExtractView


class DocumentToolsApp(ctk.CTk):
    """
    Main application shell. Coordinates sidebar navigation
    and content view swapping.
    """

    def __init__(self) -> None:
        super().__init__()

        # Window settings
        self.title("Document Tools")
        self.geometry("900x650")
        self.minsize(800, 550)

        # Set theme / appearance
        ctk.set_appearance_mode("dark")
        self.configure(fg_color=T.BG_APP)

        # Main Layout: Sidebar (left) + View container (right)
        self.grid_columnconfigure(1, weight=1)
        self.grid_rowconfigure(0, weight=1)

        # Right-side Content area container
        self._content_container = ctk.CTkFrame(self, fg_color="transparent", border_width=0, corner_radius=0)
        self._content_container.grid(row=0, column=1, sticky="nsew", padx=T.PAD_LG, pady=T.PAD_LG)

        # Instantiate all views (cached)
        self._active_view: ctk.CTkFrame | None = None
        self._views: dict[str, ctk.CTkFrame] = {
            "merge": MergeView(self._content_container),
            "split": SplitView(self._content_container),
            "pdf_utils": PdfUtilsView(self._content_container),
            "convert": ConvertView(self._content_container),
            "extract": ExtractView(self._content_container),
        }

        # Sidebar navigation
        self._sidebar = Sidebar(self, on_view_change=self._show_view)
        self._sidebar.grid(row=0, column=0, sticky="nsw")

    def _show_view(self, view_id: str) -> None:
        # Hide old view
        if self._active_view:
            self._active_view.pack_forget()

        # Show new view
        view = self._views.get(view_id)
        if view:
            view.pack(fill="both", expand=True)
            self._active_view = view


def main() -> None:
    """Launch the GUI application."""
    app = DocumentToolsApp()
    app.mainloop()


if __name__ == "__main__":
    main()
