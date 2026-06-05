import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Outlet } from "react-router-dom";
import { ClientOnly } from "vite-react-ssg";

const queryClient = new QueryClient();

// Root layout: shared providers wrap every route via <Outlet/>.
// Toasts are client-only UI with no SEO value — kept out of the SSG render.
const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <ClientOnly>{() => <><Toaster /><Sonner /></>}</ClientOnly>
      <Outlet />
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
