import { defineConfig } from "vite"

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        main: "index.html",
        login: "login.html",
        home: "home.html",
        partscat: "partscat.html",
        serviesman: "serviesman.html",
        carDetails: "car-details.html"
      }
    }
  }
})