import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider } from "@tanstack/react-router";
import { router } from "@/router";
import { AppearanceProvider } from "@/features/settings/appearance-provider";
import { DraftProvider } from "@/features/playground/draft-provider";
import "./styles.css";

const queryClient = new QueryClient();
const root = document.getElementById("root");
if (!root) throw new Error("Missing root element");

createRoot(root).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <AppearanceProvider><DraftProvider><RouterProvider router={router} /></DraftProvider></AppearanceProvider>
    </QueryClientProvider>
  </StrictMode>,
);
