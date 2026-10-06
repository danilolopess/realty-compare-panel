import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { ogImagePlugin } from './ogProxy'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), ogImagePlugin()],
})
