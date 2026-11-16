/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// base path for GitHub Pages project site
export default defineConfig({
  base: '/carbitlink-web-setup/',
  plugins: [react()],
  test: {
    environment: 'jsdom',
  },
});
