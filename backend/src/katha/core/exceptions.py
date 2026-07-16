"""Application-level exceptions for Katha."""


class KathaError(Exception):
    """Base exception for all Katha application errors."""

    def __init__(self, message: str = "An error occurred"):
        self.message = message
        super().__init__(self.message)


class NotFoundError(KathaError):
    """Raised when a requested resource is not found."""

    def __init__(self, resource: str = "Resource", resource_id: str | int | None = None):
        detail = f"{resource} not found"
        if resource_id is not None:
            detail = f"{resource} with id '{resource_id}' not found"
        super().__init__(message=detail)


class ValidationError(KathaError):
    """Raised when input validation fails at the application level."""

    def __init__(self, message: str = "Validation error"):
        super().__init__(message=message)
