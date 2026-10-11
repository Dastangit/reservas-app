const { validationResult } = require('express-validator');

const validate = (req, res, next) => {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    const list = errors.array().map((err) => ({
      field: err.path,
      message: err.msg,
    }));
    return res.status(400).json({
      success: false,
      // `error` es lo que muestra el frontend; `errors` conserva el detalle por campo.
      error: list.map((e) => e.message).join('. '),
      errors: list,
    });
  }

  next();
};

module.exports = validate;
