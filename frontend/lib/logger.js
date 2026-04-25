const dev = process.env.NODE_ENV === 'development';

// In production the SWC compiler (next.config.js → compiler.removeConsole) strips
// these calls from the mobile bundle entirely. The logger exists for local dev work.
export const log  = dev ? (...a) => console.log(...a)  : () => {};
export const warn = dev ? (...a) => console.warn(...a) : () => {};

// Errors are never silenced — they surface genuine runtime failures in Xcode.
export const error = (...a) => console.error(...a);
