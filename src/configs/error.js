export class CustomError extends Error {
  constructor(statusCode, message, options = {}) {
    super(message);
    this.name = 'CustomError';
    this.statusCode = statusCode;
    this.errors = options.errors;
  }
}

export class ValidationError extends CustomError {
  constructor(message, options) {
    super(400, message, options);
    this.name = 'ValidationError';
  }
}

export class NotFoundError extends CustomError {
  constructor(message = 'Resource not found', options) {
    super(404, message, options);
    this.name = 'NotFoundError';
  }
}

export class ConflictError extends CustomError {
  constructor(message, options) {
    super(409, message, options);
    this.name = 'ConflictError';
  }
}
