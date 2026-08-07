import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'
import { fileURLToPath } from 'url'

const __dirname = fileURLToPath(new URL('.', import.meta.url))

// Dos páginas separadas (formulario y panel de admin), sin router:
// evita problemas de "ruta no encontrada al recargar" en hosting estático.
export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        admin: resolve(__dirname, 'admin.html'),
        resetPassword: resolve(__dirname, 'reset-password.html'),
      },
    },
  },
})