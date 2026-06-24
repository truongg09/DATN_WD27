import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

const EmployeeRoute = () => {
  const { user } = useAuth();

  if (user?.role !== "employee") {
    return <Navigate to="/" />;
  }

  return <Outlet />;
};

export default EmployeeRoute;
