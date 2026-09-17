import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
  },
  build: {
    rolldownOptions: {
      output: {
        // The single minified bundle crossed the 500 kB advisory threshold. Split the
        // stable third-party groups out of it: they change far less often than the app
        // code, so browsers cache them across releases. No import becomes lazy and the
        // module order is unchanged, so runtime behaviour is identical.
        codeSplitting: {
          groups: [
            { name: 'react-vendor', test: /node_modules[\\/](react|react-dom|scheduler)[\\/]/ },
            { name: 'icons', test: /node_modules[\\/]lucide-react[\\/]/ },
            { name: 'geometry', test: /node_modules[\\/](polygon-clipping|fflate)[\\/]/ },
          ],
        },
      },
    },
  },
})
