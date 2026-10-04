import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  // Relative asset paths, so the same build works on GitHub Pages
  // (served from /KathFK1234/) and on a root domain.
  base: './',
  plugins: [react()],
  test: {
    environment: 'node',
  },
});
