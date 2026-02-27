const logger = require('../utils/logger');

const errorHandler = (err, req, res, next) => {
  logger.error(err.message || err, { stack: err.stack, status: err.status });
  const status = err.status || 500;
  const message = status === 500 ? 'Internal Server Error' : (err.message || 'Internal Server Error');
  res.status(status).json({ message });
};

module.exports = { errorHandler };
