import { NextResponse } from "next/server";
import { isApplicationError } from "./errors";

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: Array<{ field: string; message: string }>;
  };
  meta?: {
    timestamp: string;
  };
}

export function successResponse<T>(data: T): ApiResponse<T> {
  return {
    success: true,
    data,
    meta: {
      timestamp: new Date().toISOString(),
    },
  };
}

export function errorResponse(
  code: string,
  message: string,
  statusCode: number = 500,
  details?: Array<{ field: string; message: string }>
): [ApiResponse<null>, number] {
  return [
    {
      success: false,
      error: {
        code,
        message,
        details,
      },
      meta: {
        timestamp: new Date().toISOString(),
      },
    },
    statusCode,
  ];
}

export function handleError(error: unknown): NextResponse {
  console.error("API Error:", error);

  if (isApplicationError(error)) {
    const ValidationError = (require("./errors").ValidationError) as new (...args: unknown[]) => { details?: Array<{ field: string; message: string }> }; // eslint-disable-line
    const details = error instanceof ValidationError ? error.details : undefined;
    const [response, statusCode] = errorResponse(
      error.code,
      error.message,
      error.statusCode,
      details
    );
    return NextResponse.json(response, { status: statusCode });
  }

  if (error instanceof SyntaxError) {
    const [response, statusCode] = errorResponse(
      "PARSE_ERROR",
      "Invalid JSON in request body",
      400
    );
    return NextResponse.json(response, { status: statusCode });
  }

  const [response, statusCode] = errorResponse(
    "INTERNAL_ERROR",
    process.env.NODE_ENV === "production" ? "An unexpected error occurred" : String(error),
    500
  );
  return NextResponse.json(response, { status: statusCode });
}
