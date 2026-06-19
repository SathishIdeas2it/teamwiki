import pino from 'pino';

const REDACTED_PATHS = [
  'password',
  'passwordHash',
  'password_hash',
  'token',
  'secret',
  'key',
  'accessToken',
  'access_token',
  'refreshToken',
  'refresh_token',
  'idToken',
  'id_token',
  '*.password',
  '*.passwordHash',
  '*.token',
  '*.secret',
  '*.key',
  '*.accessToken',
  '*.refreshToken',
  '*.idToken',
];

const baseOptions = {
  level: process.env['LOG_LEVEL'] ?? 'info',
  redact: {
    paths: REDACTED_PATHS,
    censor: '[REDACTED]',
  },
  formatters: {
    level: (label: string) => ({ level: label }),
  },
};

export const logger =
  process.env['NODE_ENV'] !== 'production'
    ? pino({ ...baseOptions, transport: { target: 'pino-pretty', options: { colorize: true } } })
    : pino(baseOptions);
