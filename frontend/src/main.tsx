import ReactDOM from "react-dom/client"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { Toaster } from "sonner"

import App from "@/App"
import { TooltipProvider } from "@/components/ui/tooltip"

import "react-big-calendar/lib/css/react-big-calendar.css"
import "@/index.css"

const queryClient = new QueryClient()

ReactDOM.createRoot(document.getElementById("root")!).render(
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <App />
      <Toaster richColors position="top-right" />
    </TooltipProvider>
  </QueryClientProvider>
)
