from rest_framework.views import exception_handler
from rest_framework.response import Response
import logging
from drf_yasg.errors import SwaggerGenerationError

logger = logging.getLogger('drf_yasg')

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
            status=500
        )

    # Add more detailed error information
    if hasattr(exc, 'detail'):
        response.data = {
            'detail': str(exc.detail),
            'code': getattr(exc, 'code', 'error'),
            'messages': getattr(exc, 'messages', []),
        }

    return response 