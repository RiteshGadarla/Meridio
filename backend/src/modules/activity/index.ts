/**
 * FILE: backend/src/modules/activity/index.ts
 * PURPOSE: Public exports of the activity module.
 * LAYER: Module
 * USED BY: app.ts, products.service.ts
 */
export { createActivityRouter } from './activity.routes.js';
export { createActivityService, type ActivityService } from './activity.service.js';
