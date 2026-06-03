import { userRepo } from "../modules/users/repository";
import {
  destinationTypeRepo,
  poiTypeRepo,
  expenseTypeRepo,
  preferenceRepo,
} from "../modules/lookups/repository";
import { destinationRepo } from "../modules/destinations/repository";
import { poiRepo } from "../modules/pois/repository";
import { tripRepo } from "../modules/trips/repository";
import { reviewRepo } from "../modules/reviews/repository";
import { expenseRepo } from "../modules/expenses/repository";
import { noteRepo } from "../modules/expenses/notes-repository";
import { notificationRepo } from "../modules/notifications/repository";
import { adminRepo } from "../modules/admin/repository";

/**
 * Flat-merged storage facade. Modules import `storage` from "server/storage" and
 * see all repository methods as a single object — preserves the legacy API while
 * each domain repository lives co-located with its router/service/schema.
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
