import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

const StaffRoute = () => {
  const { user } = useAuth();

  const storedUser = localStorage.getItem("user");
  const currentUser = user || (storedUser ? JSON.parse(storedUser) : null);

  if (currentUser?.role !== "staff" && currentUser?.role !== "admin") {
    return <Navigate to="/" />;
  }

  return <Outlet />;
};

export default StaffRoute;
