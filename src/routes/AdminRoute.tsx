import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
  
const AdminRoute = () => {
    const { user } = useAuth();
    
    // Sync check from localStorage to prevent race conditions during login navigation
    const storedUser = localStorage.getItem("user");
    const currentUser = user || (storedUser ? JSON.parse(storedUser) : null);
  
    if (currentUser?.role !== "admin") {
      return <Navigate to="/" />;
    }
  
    return <Outlet />;
};

export default AdminRoute;