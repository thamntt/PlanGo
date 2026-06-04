import { userRepo } from "../users/repository";
import { tripRepo } from "../trips/repository";
import { destinationRepo } from "../destinations/repository";
import { destinationTypeRepo } from "../lookups/repository";

export const adminRepo = {
  async getAdminStats(): Promise<any> {
    const allUsers = await userRepo.getUsers();
    const allTrips = await tripRepo.getTrips();
    const allDestinations = await destinationRepo.getDestinations();
    const allDestTypes = await destinationTypeRepo.getDestinationTypes();

    // User status distribution
    const userStatus = allUsers.reduce((acc: any, u) => {
      const status = u.status || "active";
      acc[status] = (acc[status] || 0) + 1;
      return acc;
    }, {});

    // Trip status distribution
    const tripStatus = allTrips.reduce((acc: any, t) => {
      const status = t.status || "draft";
      acc[status] = (acc[status] || 0) + 1;
      return acc;
    }, {});

    // Destination type distribution
    const typeIdToName = allDestTypes.reduce((acc: any, t: any) => {
      acc[t.destinationtypeId] = t.typeName;
      return acc;
    }, {});

    const destinationTypes = allDestinations.reduce((acc: any, d) => {
      const typeName = d.destinationTypeId ? typeIdToName[d.destinationTypeId] : "Khác";
      acc[typeName] = (acc[typeName] || 0) + 1;
      return acc;
    }, {});

    // Monthly trip growth (last 6 months)
    const months = [
      "JAN",
      "FEB",
      "MAR",
      "APR",
      "MAY",
      "JUN",
      "JUL",
      "AUG",
      "SEP",
      "OCT",
      "NOV",
      "DEC",
    ];
    const now = new Date();
    const tripGrowth: { month: string; value: number }[] = [];

    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthLabel = months[d.getMonth()];
      const year = d.getFullYear();
      const monthNum = d.getMonth();

      const count = allTrips.filter((t) => {
        const createdAt = new Date(t.createdAt || "");
        return createdAt.getMonth() === monthNum && createdAt.getFullYear() === year;
      }).length;

      tripGrowth.push({ month: monthLabel, value: count });
    }

    return {
      userStatus,
      tripStatus,
      destinationTypes,
      tripGrowth,
      counts: {
        users: allUsers.length,
        trips: allTrips.length,
        destinations: allDestinations.length,
      },
    };
  },
};
