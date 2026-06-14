import {
    createContext,
    useContext,
    useEffect,
    useState,
    ReactNode,
  } from "react";
  
  import { User } from "../types/auth";
  
  interface LoginData {
    user: User;
    token: string;
  }
  
  interface AuthContextType {
    user: User | null;
  
    token: string | null;
  
    isAuthenticated: boolean;
  
    login: (data: LoginData) => void;
  
    logout: () => void;
  }
  
  const AuthContext =
    createContext<AuthContextType | null>(null);
  
  interface AuthProviderProps {
    children: ReactNode;
  }
  
  export const AuthProvider = ({
    children,
  }: AuthProviderProps) => {
    const [user, setUser] =
      useState<User | null>(null);
  
    const [token, setToken] =
      useState<string | null>(null);
  
    useEffect(() => {
      const storedUser =
        localStorage.getItem("user");
  
      const storedToken =
        localStorage.getItem("token");
  
      if (storedUser && storedToken) {
        setUser(JSON.parse(storedUser));
  
        setToken(storedToken);
      }
    }, []);
  
    const login = (data: LoginData) => {
      setUser(data.user);
  
      setToken(data.token);
  
      localStorage.setItem(
        "user",
        JSON.stringify(data.user)
      );
  
      localStorage.setItem(
        "token",
        data.token
      );
    };
  
    const logout = () => {
      setUser(null);
  
      setToken(null);
  
      localStorage.removeItem("user");
  
      localStorage.removeItem("token");
    };
  
    return (
      <AuthContext.Provider
        value={{
          user,
          token,
          isAuthenticated: !!token,
          login,
          logout,
        }}
      >
        {children}
      </AuthContext.Provider>
    );
  };
  
  export const useAuth = () => {
    const context =
      useContext(AuthContext);
  
    if (!context) {
      throw new Error(
        "useAuth must be used inside AuthProvider"
      );
    }
  
    return context;
};