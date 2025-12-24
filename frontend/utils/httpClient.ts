const BACKEND_API_URL = process.env.BACKEND_API_URL || process.env.NEXT_PUBLIC_BACKEND_API_URL || "";

type HttpMethod = "GET" | "POST" | "PUT" | "DELETE";

interface RequestOptions {
  headers?: Record<string, string>;
  params?: Record<string, string | number | boolean>;
  authToken?: string;
}

interface RequestOptionsWithBody extends RequestOptions {
  body?: unknown;
}

class HttpClient {
  private baseURL: string;

  constructor(baseURL: string) {
    if (!baseURL) {
      throw new Error("Base URL is required");
    }
    this.baseURL = baseURL.endsWith("/") ? baseURL.slice(0, -1) : baseURL;
  }

  private buildURL(endpoint: string, params?: Record<string, string | number | boolean>): string {
    const cleanEndpoint = endpoint.startsWith("/") ? endpoint : `/${endpoint}`;
    const url = `${this.baseURL}${cleanEndpoint}`;

    if (!params || Object.keys(params).length === 0) {
      return url;
    }

    const searchParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== null && value !== undefined) {
        searchParams.append(key, String(value));
      }
    });
    return `${url}?${searchParams.toString()}`;
  }

  private buildHeaders(options: RequestOptions): HeadersInit {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...options.headers,
    };

    if (options.authToken) {
      headers.Authorization = `Bearer ${options.authToken}`;
    }

    return headers;
  }

  private async request<T>(method: HttpMethod, endpoint: string, options: RequestOptionsWithBody = {}): Promise<T> {
    const url = this.buildURL(endpoint, options.params);
    const headers = this.buildHeaders(options);

    const config: RequestInit = {
      method,
      headers,
    };

    if (options.body && (method === "POST" || method === "PUT")) {
      config.body = JSON.stringify(options.body);
    }

    try {
      const response = await fetch(url, config);

      if (!response.ok) {
        let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
        try {
          const errorText = await response.text();
          if (errorText) {
            try {
              const errorJson = JSON.parse(errorText);
              errorMessage = errorJson.message || errorJson.error || errorText;
            } catch {
              errorMessage = errorText;
            }
          }
        } catch (error) {}
        throw new Error(errorMessage);
      }

      const contentType = response.headers.get("content-type");
      if (contentType?.includes("application/json")) {
        return await response.json();
      }

      return (await response.text()) as T;
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error(`Request failed: ${String(error)}`);
    }
  }

  async get<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
    return this.request<T>("GET", endpoint, options);
  }

  async post<T>(endpoint: string, options: RequestOptionsWithBody = {}): Promise<T> {
    return this.request<T>("POST", endpoint, options);
  }

  async put<T>(endpoint: string, options: RequestOptionsWithBody = {}): Promise<T> {
    return this.request<T>("PUT", endpoint, options);
  }

  async delete<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
    return this.request<T>("DELETE", endpoint, options);
  }
}

// Client for frontend to Next.js proxy calls
export const apiClient = new HttpClient("/api");

// Client for Next.js proxy to external backend calls
export const backendClient = BACKEND_API_URL ? new HttpClient(BACKEND_API_URL) : null;

// Factory function to create custom clients
export function createHttpClient(baseURL: string): HttpClient {
  return new HttpClient(baseURL);
}
