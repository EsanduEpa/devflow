import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig, loadEnv } from 'vite'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), ['FRONTEND_', 'API_'])

  const apiTarget = env.API_PROXY_TARGET ?? 'http://127.0.0.1:3000'

  return {
    plugins: [react(), tailwindcss()],
    server: {
      host: '127.0.0.1',
      port: Number(env.FRONTEND_PORT ?? '5173'),
      strictPort: true,
      proxy: {
        '/api': apiTarget,
        '/socket.io': { target: apiTarget, ws: true },
      },
    },
  }
})
