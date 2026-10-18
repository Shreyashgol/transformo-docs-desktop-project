import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['electron/**/*.test.js', 'src/**/*.test.{js,jsx}', 'shared/**/*.test.js'],
    environment: 'node',
  },
});
