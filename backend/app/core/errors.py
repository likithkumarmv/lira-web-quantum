from fastapi import HTTPException, Request
from fastapi.responses import JSONResponse
import uuid


class LIRAException(HTTPException):
    def __init__(self, status_code: int, code: str, message: str, request_id: str = None):
        super().__init__(status_code=status_code, detail=message)
        self.code = code
        self.message = message
        self.request_id = request_id or f"REQ-{uuid.uuid4().hex[:6].upper()}"


async def lira_exception_handler(request: Request, exc: LIRAException):
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "error": {
                "code": exc.code,
                "message": exc.message,
                "request_id": exc.request_id
            }
        }
    )


async def generic_http_exception_handler(request: Request, exc: HTTPException):
    code = "HTTP_ERROR"
    if exc.status_code == 404:
        code = "NOT_FOUND"
    elif exc.status_code == 401:
        code = "UNAUTHORIZED"
    elif exc.status_code == 403:
        code = "FORBIDDEN"
    elif exc.status_code == 422:
        code = "VALIDATION_ERROR"
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "error": {
                "code": code,
                "message": str(exc.detail),
                "request_id": f"REQ-{uuid.uuid4().hex[:6].upper()}"
            }
        }
    )

