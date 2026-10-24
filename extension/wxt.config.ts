import { defineConfig } from "wxt";

const apiBase = process.env.TIKO_API_BASE_URL || "http://localhost:3123";
const apiOrigin = new URL(apiBase).origin;

export default defineConfig({
  modules: [],
  manifest: {
    name: "Vetted · recall check",
    description: "Check a second-hand listing against official product recalls.",
    version: "0.1.0",
    key: "MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA3UD4lwY5hgBYKXIvbcxr742Ie5ybkuCC0AazXPAy85cZtkYKgjLsOn3+sNXEIkCyLC+pxBTPRSKgGDDqRXpQ5cNbPVXKcP7Uu8Jr/LNOEkMs0qiX6Vw4dEMrV+ePRXd0QXoj3O/2SPzvsX7nf78khTJtsXuI12VajEbCS8EYwXr06toAR9E9+NBoh71TmfNcldaoEmhVe+g3arcFnfPpWSsQgIk8EWgTw6egZ7ilxwyF8Xdo6STzVAzizVKTy92D+amrIj5kVFaRyLLqPfr6bCDjRnU6KFTEiMag7HS8pxPn3foiGVMmg3yKHsCaKuvDSoPdS01qHCZG/7MNCrT6RwIDAQAB",
    permissions: ["activeTab", "storage"],
    host_permissions: [`${apiOrigin}/*`],
    action: { default_title: "Vetted · check this listing" },
  },
  vite: () => ({
    define: {
      __TIKO_API_BASE_URL__: JSON.stringify(apiBase.replace(/\/$/, "")),
    },
  }),
});
