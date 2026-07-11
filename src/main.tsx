import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import dayjs from "dayjs";
import customParseFormat from "dayjs/plugin/customParseFormat";

import "./index.css";
import App from "./App";

// Cho phép dayjs(value, 'YYYY-MM-DD', true) parse nghiêm ngặt query param ngày
dayjs.extend(customParseFormat);

import { AuthProvider } from "./contexts/AuthContext";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <App />
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>
);
