import Cookies from "js-cookie";
import api from "./api";
import type { TokenResponse, User } from "./types";

export async function login(email: string, password: string): Promise<void> {
  const { data } = await api.post<TokenResponse>("/auth/login", { email, password });
  Cookies.set("access_token", data.access_token, { expires: 7, sameSite: "lax" });
}

export async function register(email: string, password: string): Promise<void> {
  const { data } = await api.post<TokenResponse>("/auth/register", { email, password });
  Cookies.set("access_token", data.access_token, { expires: 7, sameSite: "lax" });
}

export async function logout(): Promise<void> {
  await api.post("/auth/logout");
  Cookies.remove("access_token");
}

export async function getMe(): Promise<User> {
  const { data } = await api.get<User>("/auth/me");
  return data;
}

export function isAuthenticated(): boolean {
  return !!Cookies.get("access_token");
}
