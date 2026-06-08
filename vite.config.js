import { defineConfig } from "vite"

export default defineConfig({
  server: {
    proxy: {
      "/api": "http://localhost:3001"
    }
  },
  build: {
    rollupOptions: {
      input: {
        main: "index.html",
        login: "login.html",
        home: "home.html",
        partscat: "partscat.html",
        serviceman: "serviceman.html",
        carDetails: "car-details.html",
        admin: "admin.html"
      }
    }
  }
})
