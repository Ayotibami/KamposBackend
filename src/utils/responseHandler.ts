export class ApiError extends Error {
  statusCode: number;
  status: string;

  constructor(statusCode: number, message: string) {
    super(message);
    this.name = `ApiError [Status ${statusCode}]`;
    this.statusCode = statusCode;
    this.status = this.getStatusMessage(statusCode);
    Error.captureStackTrace(this, this.constructor);
  }

  static badRequest(message: string): ApiError {
    return new ApiError(400, message);
  }

  static unauthorized(message: string): ApiError {
    return new ApiError(401, message);
  }

  static forbidden(message: string): ApiError {
    return new ApiError(403, message);
  }

  static notFound(message: string): ApiError {
    return new ApiError(404, message);
  }

  static methodNotAllowed(message: string): ApiError {
    return new ApiError(405, message);
  }

  static internalServerError(message: string): ApiError {
    return new ApiError(500, message);
  }

  static unprocessableEntity(message: string): ApiError {
    return new ApiError(422, message);
  }

  static serviceUnavailable(message: string): ApiError {
    return new ApiError(503, message);
  }

  private getStatusMessage(statusCode: number): string {
    const statuses: { [key: number]: string } = {
      400: "Bad Request",
      401: "Unauthorized",
      403: "Forbidden",
      404: "Not Found",
      405: "Method Not Allowed",
      422: "Unprocessable Entity",
      500: "Internal Server Error",
      503: "Service Unavailable",
    };
    return statuses[statusCode] || "Error";
  }
}

export class ApiSuccess {
  success: boolean;
  status_code: number;
  message: string;
  data: any;

  constructor(statusCode: number, message: string, data: any = null) {
    this.success = true;
    this.status_code = statusCode;
    this.message = message;
    this.data = data;
  }

  static ok(message: string, data: any = null): ApiSuccess {
    return new ApiSuccess(200, message, data);
  }

  static created(message: string, data: any = null): ApiSuccess {
    return new ApiSuccess(201, message, data);
  }

  static noContent(
    message: string = "No content",
    data: any = null
  ): ApiSuccess {
    return new ApiSuccess(204, message, data);
  }

  static accepted(message: string, data: any = null): ApiSuccess {
    return new ApiSuccess(202, message, data);
  }

  static resetContent(
    message: string = "Content reset",
    data: any = null
  ): ApiSuccess {
    return new ApiSuccess(205, message, data);
  }
}


