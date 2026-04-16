import path from "path";
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
export default defineConfig(({ mode }) => {
    const rootDir = path.resolve(__dirname, "..");
    const env = loadEnv(mode, rootDir, "");
    const backendPort = env.PORT || "3000";
    return {
        envDir: rootDir,
        plugins: [react()],
        resolve: {
            alias: {
                "@": path.resolve(__dirname, "./src")
            }
        },
        server: {
            port: 5173,
            strictPort: true,
            proxy: {
                "/api": `http://localhost:${backendPort}`
            }
        }
    };
});
