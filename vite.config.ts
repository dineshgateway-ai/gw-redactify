import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  return {
    plugins: [react()],
    server: {
      port: env.PORT ? parseInt(env.PORT) : 3000,
      proxy: {
        '/api': {
          target: env.VITE_BACKEND_URL || 'http://localhost:8000',
          changeOrigin: false,
          secure: false,
        },
      },
    },
    build: {
      chunkSizeWarningLimit: 1000,
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes('node_modules')) {
              if (id.includes('xlsx')) return 'vendor-xlsx';
              if (id.includes('react-pdf') || id.includes('pdfjs-dist')) return 'vendor-pdf';
              if (id.includes('mammoth')) return 'vendor-mammoth';
              if (id.includes('lucide-react')) return 'vendor-lucide';
              return 'vendor';
            }
          },
        },
      },
    },
  };
});
