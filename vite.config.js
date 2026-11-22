import base44 from "@base44/vite-plugin"
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  logLevel: 'error', // Suppress warnings, only show errors
  // pdfjs-dist (vista previa de PDF) usa 'top-level await' internamente; todos los móviles
  // reales de los técnicos lo soportan desde hace años, pero el objetivo de compilación por
  // defecto de Vite es más antiguo y la build fallaba sin esto. No afecta a ninguna otra parte.
  esbuild: { supported: { 'top-level-await': true } },
  build: {
    rollupOptions: {
      output: {
        // Cada dependencia pesada en su propio trozo: se descarga solo cuando la
        // pantalla que la usa se abre (Android WebView con datos móviles).
        manualChunks(id) {
          if (!id.includes('node_modules')) return;
          const grupos = [
            ['three', 'vendor-three'],
            ['xlsx', 'vendor-xlsx'],
            ['jspdf', 'vendor-jspdf'],
            ['pdfjs-dist', 'vendor-pdfjs'],
            ['recharts', 'vendor-recharts'],
            ['react-quill', 'vendor-quill'],
            ['leaflet', 'vendor-leaflet'],
            ['embla-carousel', 'vendor-carousel'],
          ];
          for (const [pkg, nombre] of grupos) {
            if (id.includes(`node_modules/${pkg}`)) return nombre;
          }
        },
      },
    },
  },
  plugins: [
    base44({
      // Support for legacy code that imports the base44 SDK with @/integrations, @/entities, etc.
      // can be removed if the code has been updated to use the new SDK imports from @base44/sdk
      legacySDKImports: process.env.BASE44_LEGACY_SDK_IMPORTS === 'true',
      hmrNotifier: true,
      navigationNotifier: true,
      analyticsTracker: true,
      visualEditAgent: true
    }),
    react(),
  ]
});