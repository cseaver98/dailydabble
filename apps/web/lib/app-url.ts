const DEFAULT_PUBLIC_APP_URL = "http://localhost:3100";

export const getPublicAppUrl = (): string => {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || DEFAULT_PUBLIC_APP_URL;
  return baseUrl.replace(/\/+$/, "");
};

export const toPublicAppUrl = (path = "/"): string => {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${getPublicAppUrl()}${normalizedPath}`;
};
