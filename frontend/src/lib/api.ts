import axios from "axios";

export type AuthUser = {
  id: string;
  email: string;
};

export type UserLink = {
  id: string;
  title: string;
  slug: string;
  url: string;
  clicks: number;
};

type AuthResponse = {
  token: string;
  user: AuthUser;
  message: string;
};

type CurrentUserResponse = AuthUser & {
  link: UserLink[];
};

type CreateLinkResponse = {
  message: string;
  link: UserLink;
};

type GetLinksResponse = {
  links: UserLink[];
};

type UpdateLinkResponse = {
  message: string;
  link: UserLink;
};

type DeleteLinkResponse = {
  message: string;
};

export type ResolveSlugResponse = {
  slug: string;
  url: string;
  clicks?: number;
};

export type ResolveFailureKind = "not-found" | "network" | "invalid" | "server";

export const TOKEN_STORAGE_KEY = "shortit_token";

/** Render free web services can take about a minute to wake after idle spin-down. */
export const API_REQUEST_TIMEOUT_MS = import.meta.env.PROD ? 90_000 : 0;

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL ?? "/api",
  timeout: API_REQUEST_TIMEOUT_MS,
  headers: {
    "Content-Type": "application/json",
  },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem(TOKEN_STORAGE_KEY);
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export const normalizeClicks = (value: unknown): number => {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    return 0;
  }

  return Math.floor(value);
};

export const toUserLink = (link: UserLink): UserLink => ({
  id: link.id,
  title: link.title,
  slug: link.slug,
  url: link.url,
  clicks: normalizeClicks(link.clicks),
});

export const getShortUrl = (slug: string, origin = window.location.origin): string => {
  return `${origin.replace(/\/$/, "")}/${slug}`;
};

export const classifyResolveFailure = (error: unknown): ResolveFailureKind => {
  if (!axios.isAxiosError(error)) {
    return "server";
  }

  if (!error.response) {
    return "network";
  }

  if (error.response.status === 404) {
    return "not-found";
  }

  if (error.response.status === 400) {
    return "invalid";
  }

  return "server";
};

export const saveAuthToken = (token: string) => {
  localStorage.setItem(TOKEN_STORAGE_KEY, token);
};

export const clearAuthToken = () => {
  localStorage.removeItem(TOKEN_STORAGE_KEY);
};

export const hasAuthToken = () => {
  return Boolean(localStorage.getItem(TOKEN_STORAGE_KEY));
};

export const loginRequest = async (email: string, password: string): Promise<AuthResponse> => {
  const response = await api.post<AuthResponse>("/user/login", { email, password });
  return response.data;
};

export const signupRequest = async (email: string, password: string): Promise<AuthResponse> => {
  const response = await api.post<AuthResponse>("/user/signup", { email, password });
  return response.data;
};

export const getCurrentUserRequest = async (): Promise<CurrentUserResponse> => {
  const response = await api.get<CurrentUserResponse>("/user");
  return response.data;
};

export const createLinkRequest = async (url: string, slug?: string): Promise<CreateLinkResponse> => {
  const cleanedUrl = url.trim();
  const cleanedSlug = slug?.trim();
  const response = await api.post<CreateLinkResponse>("/link/create", {
    title: cleanedUrl,
    url: cleanedUrl,
    slug: cleanedSlug || undefined,
  });
  return {
    ...response.data,
    link: toUserLink(response.data.link),
  };
};

export const getLinksRequest = async (): Promise<GetLinksResponse> => {
  const response = await api.get<GetLinksResponse>("/link");
  return {
    links: (response.data.links ?? []).map((link) => toUserLink(link)),
  };
};

export const updateLinkRequest = async (slug: string, url: string): Promise<UpdateLinkResponse> => {
  const response = await api.post<UpdateLinkResponse>("/link/update", {
    slug: slug.trim().toLowerCase(),
    url: url.trim(),
  });
  return {
    ...response.data,
    link: toUserLink(response.data.link),
  };
};

export const deleteLinkRequest = async (slug: string): Promise<DeleteLinkResponse> => {
  const response = await api.delete<DeleteLinkResponse>("/link", {
    data: { slug: slug.trim().toLowerCase() },
  });
  return response.data;
};

export const resolveShortLinkRequest = async (slug: string): Promise<ResolveSlugResponse> => {
  const response = await api.get<ResolveSlugResponse>(`/link/resolve/${slug}`);
  return response.data;
};

export const getApiErrorMessage = (error: unknown): string => {
  if (!axios.isAxiosError(error)) {
    return "Something went wrong";
  }

  const message = (error.response?.data as { message?: string } | undefined)?.message;
  if (message) {
    return message;
  }

  if (!error.response) {
    if (error.code === "ECONNABORTED") {
      return "The API timed out. On Render's free instance this often means a cold start; wait about a minute and retry.";
    }

    return "Unable to reach the server. Confirm the API is running and CORS allows this origin. After idle time, Render's free API may take about a minute to wake.";
  }

  return "Request failed";
};
