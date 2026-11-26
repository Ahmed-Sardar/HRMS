const env = require('../config/env');

const levelColor = {
  info: '\x1b[36m',
  warn: '\x1b[33m',
  error: '\x1b[31m',
  debug: '\x1b[90m',
};

const write = (level, message, meta) => {
  const timestamp = new Date().toISOString();
  if (env.isProduction) {
    const payload = { timestamp, level, message };
    if (meta !== undefined) payload.meta = meta;
    // eslint-disable-next-line no-console
    console[level === 'debug' ? 'log' : level](JSON.stringify(payload));
    return;
  }
  const color = levelColor[level] || '';
  // eslint-disable-next-line no-console
  console[level === 'debug' ? 'log' : level](
    `${color}[${timestamp}] [${level.toUpperCase()}]\x1b[0m ${message}`,
    meta !== undefined ? meta : '',
  );
};

module.exports = {
  info: (message, meta) => write('info', message, meta),
  warn: (message, meta) => write('warn', message, meta),
  error: (message, meta) => write('error', message, meta),
  debug: (message, meta) => {
    if (!env.isProduction) write('debug', message, meta);
  },
};
