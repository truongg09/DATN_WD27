import { Outlet } from "react-router-dom";
import Home from "../pages/Home/Home";

const AuthLayout = () => {
  return (
    <>
      <Home />
      <Outlet />
    </>
  );
};

export default AuthLayout;
