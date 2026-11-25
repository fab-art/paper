import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "@santi020k/lumen-react/styles.css";
import "./styles.css";
import "./workspace-refinement.css";
import { registerSW } from "virtual:pwa-register";
if (import.meta.env.PROD) registerSW({ immediate: true });
ReactDOM.createRoot(document.getElementById("root")!).render(<React.StrictMode><App/></React.StrictMode>);
