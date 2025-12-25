const BACKEND_API_URL = process.env.NEXT_PUBLIC_BACKEND_API_URL || "";

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

  private async handleError(response: Response): Promise<never> {
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

  async get<T>(endpoint: string, authToken?: string): Promise<T> {
    const url = this.buildURL(endpoint);
    const response = await fetch(url, {
      method: "GET",
      headers: this.buildHeaders(authToken),
    });

    if (!response.ok) {
      await this.handleError(response);
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
      await this.handleError(response);
    }

    return response.json();
  }
}

// Client for Next.js API routes to proxy to external backend (server-side only)
export const backendClient = BACKEND_API_URL ? new HttpClient(BACKEND_API_URL) : null;

// Client for client-side code to call Next.js API routes
export const apiClient = new HttpClient("/api");
