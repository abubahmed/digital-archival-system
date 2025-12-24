const BACKEND_API_URL = process.env.BACKEND_API_URL || process.env.NEXT_PUBLIC_BACKEND_API_URL || "";

/**
 * Simple HTTP client for making requests to the backend API
 */
class HttpClient {
  private baseURL: string;

  constructor(baseURL: string) {
    if (!baseURL) {
      throw new Error("Base URL is required");
    }
    this.baseURL = baseURL.endsWith("/") ? baseURL.slice(0, -1) : baseURL;
  }

  private buildURL(endpoint: string): string {
    const cleanEndpoint = endpoint.startsWith("/") ? endpoint : `/${endpoint}`;
    return `${this.baseURL}${cleanEndpoint}`;
  }

  private buildHeaders(authToken?: string): HeadersInit {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    if (authToken) {
      headers.Authorization = `Bearer ${authToken}`;
    }

    return headers;
  }

  async get<T>(endpoint: string, authToken?: string): Promise<T> {
    const url = this.buildURL(endpoint);
    const response = await fetch(url, {
      method: "GET",
      headers: this.buildHeaders(authToken),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP ${response.status}: ${errorText || response.statusText}`);
    }

    return response.json();
  }

  async post<T>(endpoint: string, body: unknown, authToken?: string): Promise<T> {
    const url = this.buildURL(endpoint);
    const response = await fetch(url, {
      method: "POST",
      headers: this.buildHeaders(authToken),
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP ${response.status}: ${errorText || response.statusText}`);
    }

    return response.json();
  }
}

// Client for Next.js API routes to proxy to external backend
export const backendClient = BACKEND_API_URL ? new HttpClient(BACKEND_API_URL) : null;
