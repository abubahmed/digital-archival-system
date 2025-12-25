const BACKEND_API_URL = process.env.BACKEND_API_URL || process.env.NEXT_PUBLIC_BACKEND_API_URL || "";

/**
 * HTTP client for making requests to the backend API
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

/**
 * Client-side HTTP client for making requests to Next.js API routes
 */
class ApiClient {
  private buildURL(endpoint: string): string {
    // Remove leading slash if present, then add it back to ensure consistent format
    const cleanEndpoint = endpoint.startsWith("/") ? endpoint : `/${endpoint}`;
    // For client-side, use relative URLs to the Next.js API routes
    return `/api${cleanEndpoint}`;
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
    // For GET requests, also pass authToken as query param if provided (for compatibility)
    const urlObj = new URL(url, window.location.origin);
    if (authToken) {
      urlObj.searchParams.set("authToken", authToken);
    }

    const response = await fetch(urlObj.toString(), {
      method: "GET",
      headers: this.buildHeaders(authToken),
    });

    if (!response.ok) {
      let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
      try {
        const errorData = await response.json();
        errorMessage = errorData.error || errorMessage;
      } catch {
        // If response is not JSON, use the text
        const errorText = await response.text();
        if (errorText) {
          errorMessage = errorText;
        }
      }
      throw new Error(errorMessage);
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
      let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
      try {
        const errorData = await response.json();
        errorMessage = errorData.error || errorMessage;
      } catch {
        // If response is not JSON, use the text
        const errorText = await response.text();
        if (errorText) {
          errorMessage = errorText;
        }
      }
      throw new Error(errorMessage);
    }

    return response.json();
  }
}

// Client for Next.js API routes to proxy to external backend (server-side only)
export const backendClient = BACKEND_API_URL ? new HttpClient(BACKEND_API_URL) : null;

// Client for client-side code to call Next.js API routes
export const apiClient = new ApiClient();
