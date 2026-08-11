from .exceptions import DocumentToolsError, ProcessingError, UnsupportedFormatError, ValidationError
from .models import (
    CompressPdfOptions,
    DocumentInput,
    DocumentType,
    FaviconOptions,
    OperationResult,
    OutputFormat,
    PageRange,
)

__all__ = [
    "CompressPdfOptions",
    "DocumentInput",
    "DocumentToolsError",
    "DocumentType",
    "FaviconOptions",
    "OperationResult",
    "OutputFormat",
    "PageRange",
    "ProcessingError",
    "UnsupportedFormatError",
    "ValidationError",
]
