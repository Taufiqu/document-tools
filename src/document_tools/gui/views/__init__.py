"""Views package for Document Tools GUI."""
from document_tools.gui.views.merge_view import MergeView
from document_tools.gui.views.split_view import SplitView
from document_tools.gui.views.pdf_utils_view import PdfUtilsView
from document_tools.gui.views.convert_view import ConvertView
from document_tools.gui.views.extract_view import ExtractView

__all__ = [
    "MergeView",
    "SplitView",
    "PdfUtilsView",
    "ConvertView",
    "ExtractView",
]
