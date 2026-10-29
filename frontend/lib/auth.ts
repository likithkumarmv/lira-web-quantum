"use client";

export interface AuthUser {
  user_code: string;
  role: "DISPATCHER" | "OPS_MANAGER" | "DRIVER" | "AUDITOR";
  display_name: string;
  truck_id?: string;
  token?: string;
}

const DEFAULT_USER: AuthUser = {
  user_code: "DISPATCHER_01",
  role: "DISPATCHER",
  display_name: "Chief Dispatcher Sharma",
  truck_id: undefined,
  token: "DEMO_SESSION_TOKEN_DISPATCHER"
};

export function getCurrentUser(): AuthUser {
  if (typeof window === "undefined") return DEFAULT_USER;
  try {
    const stored = localStorage.getItem("lira_current_user");
    if (stored) return JSON.parse(stored);
  } catch (e) {
    // fallback
  }
  return DEFAULT_USER;
}

export function setCurrentUser(user: AuthUser) {
  if (typeof window !== "undefined") {
    localStorage.setItem("lira_current_user", JSON.stringify(user));
  }
}

