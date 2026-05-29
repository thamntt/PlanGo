import type { Express } from "express";
import { createServer, type Server } from "node:http";
import { storage } from "../storage";
import { logger } from "../lib/logger";
import {
  getActiveProvider,
  getGoogleKey,
  getGoongKey,
  getSerpApiKey,
} from "../lib/api-keys";

import { registerPlacesRoutes } from "../modules/places/router";
import { registerShareRoutes } from "../modules/share/router";
import { registerItineraryRoutes } from "../modules/itinerary/router";
import { registerUserRoutes } from "../modules/users/router";
import { registerDestinationRoutes } from "../modules/destinations/router";
import { registerTripRoutes } from "../modules/trips/router";
import { registerReviewRoutes } from "../modules/reviews/router";
import { registerPoiRoutes } from "../modules/pois/router";
import { registerLookupRoutes } from "../modules/lookups/router";
import { registerNotificationRoutes } from "../modules/notifications/router";
import { registerAdminRoutes } from "../modules/admin/router";
import { registerDocsRoutes } from "../modules/docs/router";

function logActiveProvider() {
  const provider = getActiveProvider();
  logger.info(
    {
      mapProvider: provider,
      serpApi: !!getSerpApiKey(),
      google: !!getGoogleKey(),
      goong: !!getGoongKey(),
    },
    "Map providers configured",
  );
}

function seedLookupTables() {
  storage.seedDestinationTypes().catch((err) => logger.error({ err }, "Destination type seeding failed"));
  storage.seedPoiTypes().catch((err) => logger.error({ err }, "POI type seeding failed"));
  storage.seedPreferences().catch((err) => logger.error({ err }, "Preference seeding failed"));
  storage.seedAdminUser().catch((err) => logger.error({ err }, "Admin user seeding failed"));
}

export async function registerRoutes(app: Express): Promise<Server> {
  logActiveProvider();
  seedLookupTables();

  registerPlacesRoutes(app);
  registerShareRoutes(app);
  registerItineraryRoutes(app);
  registerUserRoutes(app);
  registerDestinationRoutes(app);
  registerTripRoutes(app);
  registerReviewRoutes(app);
  registerPoiRoutes(app);
  registerLookupRoutes(app);
  registerNotificationRoutes(app);
  registerAdminRoutes(app);
  registerDocsRoutes(app);

  return createServer(app);
}
