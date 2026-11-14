import type { ErrorRequestHandler, RequestHandler } from 'express'
import mongoose from 'mongoose'
import { ApiError } from '../shared/api-error.js'

export const notFound: RequestHandler = (_request, _response, next) => {
  next(new ApiError(404, 'NOT_FOUND', 'The requested resource was not found.'))
}

function normalizeError(error: unknown): ApiError {
  if (error instanceof ApiError) {
    return error
  }

  if (error instanceof Error && 'type' in error) {
    switch (error.type) {
      case 'entity.parse.failed':
        return new ApiError(400, 'VALIDATION_ERROR', 'The request body contains invalid JSON.')
      case 'entity.too.large':
        return new ApiError(413, 'PAYLOAD_TOO_LARGE', 'The request body exceeds the size limit.')
      case 'charset.unsupported':
      case 'encoding.unsupported':
        return new ApiError(415, 'UNSUPPORTED_MEDIA_TYPE', 'The request encoding is unsupported.')
      case 'request.aborted':
      case 'request.size.invalid':
        return new ApiError(400, 'VALIDATION_ERROR', 'The request body is incomplete or invalid.')
    }
  }

  if (error instanceof URIError && 'status' in error && error.status === 400) {
    return new ApiError(400, 'VALIDATION_ERROR', 'The request path contains invalid encoding.')
  }

  if (
    error instanceof mongoose.mongo.MongoNetworkError ||
    error instanceof mongoose.mongo.MongoServerSelectionError ||
    error instanceof mongoose.mongo.MongoNotConnectedError ||
    error instanceof mongoose.mongo.MongoTopologyClosedError ||
    error instanceof mongoose.Error.MongooseServerSelectionError
  ) {
    return new ApiError(503, 'SERVICE_UNAVAILABLE', 'The database is temporarily unavailable.')
  }

  return new ApiError(500, 'INTERNAL_ERROR', 'An unexpected error occurred.')
}

export const handleError: ErrorRequestHandler = (error: unknown, request, response, next) => {
  if (response.headersSent) {
    next(error)
    return
  }

  const { status, code, message, details } = normalizeError(error)

  if (status >= 500) {
    console.error('DevFlow API request failed', { method: request.method, status, code })
  }

  response.status(status).json({ error: { code, message, details } })
}
