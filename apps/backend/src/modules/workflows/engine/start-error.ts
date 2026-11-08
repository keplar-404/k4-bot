const HTTP_STATUS = {
  NOT_FOUND: 404,
  NOT_READY: 422,
  TOO_LARGE: 413,
  LIMIT: 429,
  BUSY: 429,
  BOT_LIMIT: 429,
  UNAVAILABLE: 503,
} as const;
export type RunStartCode = keyof typeof HTTP_STATUS;

/** A run that could not start, with the HTTP status a route answers with. The message is safe to show. */
export class RunStartError extends Error {
  readonly status: (typeof HTTP_STATUS)[RunStartCode];
  constructor(
    readonly code: RunStartCode,
    message: string,
  ) {
    super(message);
    this.status = HTTP_STATUS[code];
  }
}
