import axios, { AxiosError } from 'axios';
import type { ApiResponse } from '../types';

const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '/api';

export const http = axios.create({
  baseURL: BASE_URL,
  timeout: 30_000,
  headers: { 'Content-Type': 'application/json' },
});

export class ApiClientError extends Error {
  code: string;
  status?: number;
  details?: unknown;

  constructor(message: string, code = 'CLIENT_ERROR', status?: number, details?: unknown) {
    super(message);
    this.name = 'ApiClientError';
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

export async function apiRequest<T>(
  path: string,
  options?: { method?: string; data?: unknown; params?: Record<string, unknown> },
): Promise<ApiResponse<T>> {
  try {
    const res = await http.request<ApiResponse<T>>({
      url: path,
      method: options?.method ?? 'GET',
      data: options?.data,
      params: options?.params,
    });
    return res.data;
  } catch (err) {
    if (axios.isAxiosError(err)) {
      const ax = err as AxiosError<ApiResponse<unknown>>;
      if (ax.response?.data) {
        return ax.response.data as ApiResponse<T>;
      }
      if (ax.code === 'ECONNABORTED') {
        return {
          success: false,
          error: { code: 'TIMEOUT', message: 'Request timed out. Is the CódigoFlow server running?' },
        };
      }
      if (!ax.response) {
        return {
          success: false,
          error: {
            code: 'NETWORK_ERROR',
            message: 'Cannot reach the API. Start the server with npm run dev:server.',
          },
        };
      }
      return {
        success: false,
        error: {
          code: 'HTTP_ERROR',
          message: ax.message,
        },
      };
    }
    return {
      success: false,
      error: { code: 'UNKNOWN', message: err instanceof Error ? err.message : 'Unknown error' },
    };
  }
}
