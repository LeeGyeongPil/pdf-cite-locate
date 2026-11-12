export type LocateErrorCode = "INVALID_TEXT_CONTENT" | "INVALID_PAGE" | "INVALID_OPTIONS";

/** Thrown for malformed input. The message says what was wrong and how to fix it. */
export class LocateError extends Error {
  readonly code: LocateErrorCode;

  constructor(code: LocateErrorCode, message: string) {
    super(message);
    this.name = "LocateError";
    this.code = code;
  }
}
