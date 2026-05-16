import "./index.css";
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.tsx";
import { OpenAPI } from "./client/core/OpenAPI";

OpenAPI.BASE = import.meta.env.VITE_API_URL ?? "http://localhost:8000";
OpenAPI.WITH_CREDENTIALS = true;

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
