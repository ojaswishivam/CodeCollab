/// <reference types="vite/client" />

// CodeCollab dynamic network configuration

const getApiBaseUrl = (): string => {
  if (typeof import.meta !== "undefined" && import.meta.env && import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL;
  }
  const protocol = typeof window !== "undefined" && window.location.protocol === "https:" ? "https:" : "http:";
  const hostname = typeof window !== "undefined" && window.location.hostname ? window.location.hostname : "localhost";
  return `${protocol}//${hostname}:1234`;
};

const getWsBaseUrl = (): string => {
  if (typeof import.meta !== "undefined" && import.meta.env && import.meta.env.VITE_WS_URL) {
    return import.meta.env.VITE_WS_URL;
  }
  const protocol = typeof window !== "undefined" && window.location.protocol === "https:" ? "wss:" : "ws:";
  const hostname = typeof window !== "undefined" && window.location.hostname ? window.location.hostname : "localhost";
  return `${protocol}//${hostname}:1234`;
};

export const API_URL = getApiBaseUrl();
export const WS_URL = getWsBaseUrl();
