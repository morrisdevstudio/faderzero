import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { inventoryApi } from './server/inventoryApi';
import { InventoryRepository } from './server/inventoryRepository';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spritePreviewApi } from './server/spritePreviewApi';
import { inlineSvgPreviewApi } from './server/inlineSvgPreviewApi';
import { reactIconPreviewApi } from './server/reactIconPreviewApi';
import { iconCaptureApi } from './server/iconCaptureApi';
import { resolveCatalogInventoryPath } from './server/inventoryPath';

const catalogDirectory = dirname(fileURLToPath(import.meta.url));
const repositoryRoot = resolve(catalogDirectory, '../..');

export default defineConfig({
  root: catalogDirectory,
  // The catalogue is a separate Vite application. It deliberately reuses only
  // FaderZero's public assets; none of its source is part of the main build.
  publicDir: resolve(repositoryRoot, 'public'),
  plugins: [react(), { name: 'local-inventory-api', configureServer(server) {
    const inventoryPath = resolveCatalogInventoryPath(repositoryRoot);
    const inventoryRepository = new InventoryRepository(inventoryPath);
    server.middlewares.use(spritePreviewApi(resolve(repositoryRoot, 'public/icons.svg')));
    server.middlewares.use(inlineSvgPreviewApi(inventoryRepository, repositoryRoot));
    server.middlewares.use(reactIconPreviewApi(inventoryRepository, repositoryRoot));
    server.middlewares.use(iconCaptureApi(repositoryRoot));
    server.middlewares.use(inventoryApi(inventoryRepository));
  }}],
});
