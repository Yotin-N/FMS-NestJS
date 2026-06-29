export const DEFAULT_CORS_ORIGINS = [
  'http://localhost:3000',
  'http://localhost:3001',
  'http://localhost:5173',
  'https://farm-management-theta.vercel.app',
];

const VERCEL_PREVIEW_ORIGIN_PATTERN =
  /^https:\/\/farm-management-[a-z0-9-]+-yotins-projects\.vercel\.app$/;

export type CorsOriginCallback = (error: Error | null, allow?: boolean) => void;

export function parseCorsOrigins(corsOrigin?: string): string[] {
  const origins =
    corsOrigin && corsOrigin.trim().length > 0
      ? corsOrigin.split(',')
      : DEFAULT_CORS_ORIGINS;

  return origins.map((origin) => origin.trim()).filter(Boolean);
}

export function isAllowedCorsOrigin(
  origin: string | undefined,
  allowedOrigins: string[],
): boolean {
  return (
    !origin ||
    allowedOrigins.includes(origin) ||
    VERCEL_PREVIEW_ORIGIN_PATTERN.test(origin)
  );
}

export function buildCorsOriginDelegate(corsOrigin?: string) {
  const allowedOrigins = parseCorsOrigins(corsOrigin);

  return (origin: string | undefined, callback: CorsOriginCallback) => {
    if (isAllowedCorsOrigin(origin, allowedOrigins)) {
      callback(null, true);
      return;
    }

    callback(new Error(`Origin ${origin} is not allowed by CORS`));
  };
}
