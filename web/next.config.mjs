// O navegador fala só com o próprio site (/api/...). O Next repassa essas chamadas para a API FastAPI,
// então não há CORS e a URL da API não precisa ser pública.
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

const API_URL = process.env.API_URL ?? "http://localhost:8000";

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  // Evita que o Next adote um package-lock.json de uma pasta acima (ex.: ~/package-lock.json) como raiz.
  turbopack: { root: dirname(fileURLToPath(import.meta.url)) },
  async rewrites() {
    return [{ source: "/api/:path*", destination: `${API_URL}/api/:path*` }];
  },
};

export default nextConfig;
