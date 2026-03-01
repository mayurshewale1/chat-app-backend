const logger = require('../utils/logger');

const errorHandler = (err, req, res, next) => {
  logger.error(err.message || err, { stack: err.stack, status: err.status });
  let status = err.status || 500;
  let message = status === 500 ? 'Internal Server Error' : (err.message || 'Internal Server Error');
  if (err.code === 'LIMIT_FILE_SIZE') {
    status = 400;
    message = 'Image too large (max 25MB)';
  } else if (err.message && err.message.includes('Only images')) {
    status = 400;
    message = err.message;
  }
  res.status(status).json({ message });
};

module.exports = { errorHandler };
