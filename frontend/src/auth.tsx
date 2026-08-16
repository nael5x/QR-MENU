import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { storage } from "@/src/utils/storage";
import { apiGet, apiPost, TOKEN_KEY } from "@/src/api";

export interface User {
  id: string;
  email: string;
  name: string;
  role: "admin" | "staff";
  tenant_id: string;
}

export interface Restaurant {
  id: string;
  name: string;
  languages: string[];
  orders_enabled: boolean;
}

interface AuthCtx {
  user: User | null;
  restaurant: Restaurant | null;
  loading: boolean;
  isAdmin: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (restaurant_name: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
  setRestaurant: (r: Restaurant) => void;
}

const Ctx = createContext<AuthCtx>(null as any);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [restaurant, setRestaurantState] = useState<Restaurant | null>(null);
  const [loading, setLoading] = useState(true);

  const bootstrap = useCallback(async () => {
    const token = await storage.secureGet<string>(TOKEN_KEY, "");
    if (!token) {
      setLoading(false);
      return;
    }
    try {
      const data = await apiGet("/auth/me");
      setUser(data.user);
      setRestaurantState(data.restaurant);
    } catch {
      await storage.secureRemove(TOKEN_KEY);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    bootstrap();
  }, [bootstrap]);

  const persist = async (data: any) => {
    await storage.secureSet(TOKEN_KEY, data.access_token);
    setUser(data.user);
    setRestaurantState(data.restaurant);
  };

  const login = useCallback(async (email: string, password: string) => {
    const data = await apiPost("/auth/login", { email, password });
    await persist(data);
  }, []);

  const register = useCallback(async (restaurant_name: string, email: string, password: string) => {
    const data = await apiPost("/auth/register", { restaurant_name, email, password, languages: ["ar", "en"] });
    await persist(data);
  }, []);

  const logout = useCallback(async () => {
    await storage.secureRemove(TOKEN_KEY);
    setUser(null);
    setRestaurantState(null);
  }, []);

  const refresh = useCallback(async () => {
    const data = await apiGet("/auth/me");
    setUser(data.user);
    setRestaurantState(data.restaurant);
  }, []);

  const setRestaurant = useCallback((r: Restaurant) => setRestaurantState(r), []);

  return (
    <Ctx.Provider
      value={{
        user,
        restaurant,
        loading,
        isAdmin: user?.role === "admin",
        login,
        register,
        logout,
        refresh,
        setRestaurant,
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

export const useAuth = () => useContext(Ctx);
