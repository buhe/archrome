import { defineConfig } from 'vite';
import { resolve } from 'path';
import { viteStaticCopy } from 'vite-plugin-static-copy';
import { readFileSync, writeFileSync } from 'fs';
import type { Plugin } from 'vite';

/**
 * Plugin to write HTML with correct CSS reference
 */
function writeHtml(): Plugin {
  return {
    name: 'write-html',
    writeBundle() {
      // Read the HTML template
      const htmlPath = resolve(__dirname, 'src/sidebar.html');
      let html = readFileSync(htmlPath, 'utf-8');

      // Ensure the CSS link is correct (pointing to style.css)
      html = html.replace(
        /<link rel="stylesheet" href="[^"]*">/,
        '<link rel="stylesheet" href="./styles/style.css">'
      );

      // Write to dist
      writeFileSync(resolve(__dirname, 'dist/sidebar.html'), html);
    },
  };
}

export default defineConfig({
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        background: resolve(__dirname, 'src/background.ts'),
        sidebar: resolve(__dirname, 'src/sidebar.ts'),
      },
      output: {
        entryFileNames: '[name].js',
        chunkFileNames: '[name].js',
        assetFileNames: (assetInfo) => {
          if (assetInfo.name?.endsWith('.css')) {
            return 'styles/[name][extname]';
          }
          return '[name][extname]';
        },
        dir: 'dist',
        format: 'es',
      },
    },
    // Ensure CSS is extracted as separate file
    cssCodeSplit: false,
  },
  plugins: [
    // Copy manifest.json and icons
    viteStaticCopy({
      targets: [
        {
          src: 'public/manifest.json',
          dest: '.',
        },
        {
          src: 'public/icons/*',
          dest: 'icons',
        },
      ],
    }),
    // Write HTML with correct CSS link
    writeHtml(),
  ],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
      '@types': resolve(__dirname, 'src/types'),
      '@managers': resolve(__dirname, 'src/managers'),
      '@ui': resolve(__dirname, 'src/ui'),
      '@utils': resolve(__dirname, 'src/utils'),
      '@styles': resolve(__dirname, 'src/styles'),
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    include: ['tests/**/*'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
    },
  },
});
