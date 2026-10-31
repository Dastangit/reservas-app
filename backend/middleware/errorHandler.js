const errorHandler = (err, req, res, _next) => {
  let statusCode = err.statusCode || 500;
  let message = err.message;

  console.error(err.stack);

  if (err.name === 'CastError') {
    message = 'Resource not found';
    statusCode = 404;
  }

  if (err.code === 11000) {
    message = 'Duplicate field value entered';
    statusCode = 400;
  }

  if (err.name === 'ValidationError') {
    message = Object.values(err.errors).map((val) => val.message).join(', ');
    statusCode = 400;
  }

  // body-parser: JSON mal formado o demasiado grande.
  if (err.type === 'entity.parse.failed') {
    message = 'Invalid JSON body';
    statusCode = 400;
  }
  if (err.type === 'entity.too.large') {
    message = 'Request body too large';
    statusCode = 413;
  }

  // En produccion un 500 nunca expone detalles internos (stack, mensajes de Mongo, etc.).
  if (statusCode >= 500 && process.env.NODE_ENV === 'production') {
    message = 'Server Error';
  }

  res.status(statusCode).json({
    success: false,
    error: message || 'Server Error',
  });
};

module.exports = errorHandler;
