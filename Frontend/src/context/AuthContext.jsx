import { createContext, useState, useCallback } from "react";
import axios from "axios";
import server from "../environment";

export const AuthContext = createContext(null);

const client = axios.create({
  baseURL: `${server}/api/v1/users`,
});

// Attach token automatically
client.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export const AuthProvider = ({ children }) => {
  const [userData, setUserData] = useState(null);

  // Register
  const handleRegister = useCallback(async (name, username, password) => {
    const res = await client.post("/register", {
      name,
      username,
      password,
    });
    return res.data.message;
  }, []);

  // Login
  const handleLogin = useCallback(async (username, password) => {
    const res = await client.post("/login", {
      username,
      password,
    });

    localStorage.setItem("token", res.data.token);
    setUserData(res.data.user);
    return "Login successful";
  }, []);

  // Get history
  const getHistoryOfUser = useCallback(async () => {
    const res = await client.get("/get_all_activity");
    return res.data;
  }, []);

  const addToUserHistory = useCallback(async (meetingCode) => {
    const res = await client.post("/add_to_activity", {
      meeting_code: meetingCode,
    });
    return res.data;
  }, []);
  
  const value = {
    userData,
    setUserData,
    handleRegister,
    handleLogin,
    getHistoryOfUser,
    addToUserHistory,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
