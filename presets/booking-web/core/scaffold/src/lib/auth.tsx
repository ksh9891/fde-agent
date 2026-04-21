"use client";

import { createContext, useContext, useState, useCallback, ReactNode } from "react";

interface User {
  id: string;
  name: string;
  email: string;
  role: "admin" | "manager" | "viewer";
}

interface AuthContextType {
  user: User | null;
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => void;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

const DEFAULT_USER: User = {
  id: "1",
  name: "관리자",
  email: "admin@example.com",
  role: "admin",
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);

  const login = useCallback(async (_email: string, _password: string): Promise<boolean> => {
    setUser(DEFAULT_USER);
    return true;
  }, []);

  const logout = useCallback(() => {
    setUser(null);
  }, []);

  return (
    <AuthContext value={{
      user,
      login,
      logout,
      isAuthenticated: user !== null,
    }}>
      {children}
    </AuthContext>
  );
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
