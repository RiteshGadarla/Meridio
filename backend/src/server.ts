/**
 * FILE: backend/src/server.ts
 * PURPOSE: Process entry point. Creates the app and starts listening.
 * LAYER: Entry
 * USED BY: `npm run dev` (tsx) and `npm start` (node dist/server.js)
 * DEPENDS ON: app.ts
 * NOTES: Binds 0.0.0.0 on process.env.PORT because hosts like Render inject PORT and need external binding.
 */
import { createApp } from './app.js';

const port = Number(process.env.PORT ?? 4000);
const app = createApp();

// TODO(stage-2): graceful shutdown on SIGTERM/SIGINT and validated env config.
app.listen(port, '0.0.0.0', () => {
  console.log(`StockFlow API listening on port ${port}`);
});
