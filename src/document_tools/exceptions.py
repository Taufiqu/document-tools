class DocumentToolsError(Exception):
    """Base exception for document processing errors."""


class ValidationError(DocumentToolsError):
    """Raised when request input is invalid."""


class UnsupportedFormatError(DocumentToolsError):
    """Raised when a document type or conversion path is unsupported."""


class ProcessingError(DocumentToolsError):
    """Raised when document processing fails at runtime."""
