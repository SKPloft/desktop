import "../src/styles.css";
import ReactDOM from "react-dom/client";
import { HeroUIProvider } from "@heroui/react";
import App from "./App";
import { initI18n } from "../src/lib/i18n";

initI18n()
  .catch((err) => console.warn("i18n init failed:", err))
  .finally(() => {
    ReactDOM.createRoot(document.getElementById("root")!).render(
      <HeroUIProvider>
        <App />
      </HeroUIProvider>,
    );
  });
