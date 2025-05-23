from rest_framework.views import exception_handler
from rest_framework.response import Response
from rest_framework import status
import logging
from drf_yasg.errors import SwaggerGenerationError

logger = logging.getLogger(__name__)

def custom_exception_handler(exc, context):
    # Call REST framework's default exception handler first
    response = exception_handler(exc, context)

    if response is None:
        if isinstance(exc, SwaggerGenerationError):
            logger.error(f"Swagger Generation Error: {str(exc)}", exc_info=True)
            return Response(
                {"detail": "Error generating API documentation. Please check the logs."},
                status=500
            )
        
        logger.error(f"Unhandled exception: {exc}", exc_info=True)
        return Response(
            {"detail": "Internal server error"},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )

    # Add more detailed error information
    if hasattr(exc, 'detail'):
        response.data = {
            'detail': str(exc.detail),
            'code': getattr(exc, 'code', 'error'),
            'messages': getattr(exc, 'messages', []),
        }

    # Add custom error handling here if needed
    if response.status_code == status.HTTP_401_UNAUTHORIZED:
        response.data = {
            "detail": "Authentication credentials were not provided.",
            "code": "authentication_failed"
        }

    return response 