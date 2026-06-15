import AppRoutes from "./routes/AppRoutes";
import { ConfigProvider } from "antd";
import { ToastContainer } from "react-toastify";

function App() {
  return (
    <ConfigProvider>
      <AppRoutes />

      <ToastContainer />
    </ConfigProvider>
  );
}

export default App;