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

// This project does not use a service worker. Remove workers left behind by
// older builds on the same origin; otherwise their fetch handler can keep
// intercepting API/navigation requests and reject with "Failed to fetch".
if ("serviceWorker" in navigator) {
  void (async () => {
    try {
      const registrations = await navigator.serviceWorker.getRegistrations();
      if (registrations.length === 0) return;

      await Promise.all(registrations.map((registration) => registration.unregister()));

      if ("caches" in window) {
        const cacheNames = await caches.keys();
        await Promise.all(cacheNames.map((cacheName) => caches.delete(cacheName)));
      }

      const reloadKey = "hotelhub-service-worker-cleanup";
      if (!sessionStorage.getItem(reloadKey)) {
        sessionStorage.setItem(reloadKey, "done");
        window.location.reload();
      }
    } catch (error) {
      console.warn("Không thể gỡ service worker cũ:", error);
    }
  })();
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <App />
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>
);
