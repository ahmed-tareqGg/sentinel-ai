import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const backendUrl = env.VITE_SUPABASE_URL || "https://kglmzurhiiuhxmzykkqv.supabase.co";
  const publishableKey =
    env.VITE_SUPABASE_PUBLISHABLE_KEY ||
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtnbG16dXJoaWl1aHhtenlra3F2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY4MjYxNjYsImV4cCI6MjA4MjQwMjE2Nn0.IRvieBBinUcoqE8B26UuuxO7EedRMZRKWGV2tOVkD8s";

  return {
    define: {
      "import.meta.env.VITE_SUPABASE_URL": JSON.stringify(backendUrl),
      "import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY": JSON.stringify(publishableKey),
      "import.meta.env.VITE_SUPABASE_PROJECT_ID": JSON.stringify(
        env.VITE_SUPABASE_PROJECT_ID || "kglmzurhiiuhxmzykkqv"
      ),
    },
    server: {
      host: "::",
      port: 8080,
    },
    plugins: [
      react(),
      mode === 'development' && componentTagger(),
    ].filter(Boolean),
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
      dedupe: ["react", "react-dom", "react/jsx-runtime"],
    },
  };
});
