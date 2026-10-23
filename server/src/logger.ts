/** Minimal logger — never log SDP, ICE, or secrets. */
export const log = {
  info(message: string, meta?: Record<string, string | number | boolean>) {
    console.info(JSON.stringify({ level: "info", message, ...meta, at: new Date().toISOString() }));
  },
  warn(message: string, meta?: Record<string, string | number | boolean>) {
    console.warn(JSON.stringify({ level: "warn", message, ...meta, at: new Date().toISOString() }));
  },
  error(message: string, meta?: Record<string, string | number | boolean>) {
    console.error(JSON.stringify({ level: "error", message, ...meta, at: new Date().toISOString() }));
  },
};
