import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
  
const AdminRoute = () => {
    const { user } = useAuth();
  
    if (user?.role !== "admin") {
      return <Navigate to="/" />;
    }
  
    return <Outlet />;
};
  
export default AdminRoute;