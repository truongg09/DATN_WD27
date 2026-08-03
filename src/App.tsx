import AppRoutes from "./routes/AppRoutes";
import { ConfigProvider } from "antd";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

function App() {
  return (
    <ConfigProvider>
      <AppRoutes />

      <ToastContainer />
    </ConfigProvider>
  );
}

export default App;
