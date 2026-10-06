import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { ogImagePlugin } from './ogProxy'
import { authPlugin } from './server/plugin'

// https://vite.dev/config/
export default defineConfig({
  plugins: [authPlugin(), react(), ogImagePlugin()],
})
