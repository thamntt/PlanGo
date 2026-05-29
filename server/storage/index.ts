import { userRepo } from "./users";
import {
  destinationTypeRepo,
  poiTypeRepo,
  expenseTypeRepo,
  preferenceRepo,
} from "./lookups";
import { destinationRepo } from "./destinations";
import { poiRepo } from "./pois";
import { tripRepo } from "./trips";
import { reviewRepo } from "./reviews";
import { expenseRepo } from "./expenses";
import { noteRepo } from "./notes";
import { notificationRepo } from "./notifications";
import { adminRepo } from "./admin";

/**
 * Flat-merged storage facade. Modules importing `storage` from "server/storage"
 * see all repository methods as a single object — preserving the legacy API.
 */
export const storage = {
  ...userRepo,
  ...destinationTypeRepo,
  ...poiTypeRepo,
  ...expenseTypeRepo,
  ...preferenceRepo,
  ...destinationRepo,
  ...poiRepo,
  ...tripRepo,
  ...reviewRepo,
  ...expenseRepo,
  ...noteRepo,
  ...notificationRepo,
  ...adminRepo,
};

export type Storage = typeof storage;
