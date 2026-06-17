import { db } from "../server/db";
import { trips, itineraryDay, itineraryItems, users } from "../shared/schema";
import { eq } from "drizzle-orm";

/**
 * Seed realistic itinerary (days + items) for every trip owned by `thamnt123`
 * that currently has no days. Idempotent — re-running skips trips that
 * already have itinerary data.
 */

interface DayPlan {
  title: string;
  items: { time: string; title: string; type: string; notes?: string }[];
}

const TEMPLATES: Record<string, DayPlan[]> = {
  default: [
    {
      title: "Ngày 1 — Đến nơi & khám phá quanh khách sạn",
      items: [
        { time: "08:00", title: "Bay sớm", type: "transport", notes: "Check-in trước 1.5h" },
        { time: "11:30", title: "Nhận phòng khách sạn", type: "lodging" },
        { time: "12:30", title: "Ăn trưa quán địa phương", type: "food" },
        { time: "15:00", title: "Đi bộ thám hiểm trung tâm", type: "sightseeing" },
        { time: "19:00", title: "Ăn tối + đi dạo phố đêm", type: "food" },
      ],
    },
    {
      title: "Ngày 2 — Trải nghiệm điểm chính",
      items: [
        { time: "07:30", title: "Ăn sáng tại khách sạn", type: "food" },
        { time: "09:00", title: "Tham quan landmark chính", type: "sightseeing" },
        { time: "12:30", title: "Trưa nhẹ ở quán view đẹp", type: "food" },
        { time: "14:30", title: "Hoạt động/spa/mua sắm", type: "activity" },
        { time: "18:30", title: "Ăn tối hải sản/đặc sản", type: "food" },
      ],
    },
    {
      title: "Ngày 3 — Cafe & về",
      items: [
        { time: "08:00", title: "Cafe sáng + chụp hình", type: "food" },
        { time: "10:00", title: "Mua quà về nhà", type: "shopping" },
        { time: "12:00", title: "Trả phòng + ra sân bay", type: "transport" },
        { time: "15:00", title: "Bay về", type: "transport" },
      ],
    },
  ],
};

async function main() {
  const [tham] = await db.select().from(users).where(eq(users.userName, "thamnt123"));
  if (!tham) {
    console.log("❌ User thamnt123 not found");
    process.exit(1);
  }
  console.log(`Seeding for user '${tham.userName}' (id=${tham.userId})`);

  const myTrips = await db.select().from(trips).where(eq(trips.ownerId, tham.userId));
  console.log(`Found ${myTrips.length} trip(s)`);

  let seededCount = 0;
  for (const trip of myTrips) {
    const existingDays = await db
      .select({ id: itineraryDay.dayId })
      .from(itineraryDay)
      .where(eq(itineraryDay.tripId, trip.tripId));
    if (existingDays.length > 0) {
      console.log(`  · Skip trip "${trip.title}" — already has ${existingDays.length} day(s)`);
      continue;
    }

    const plan = TEMPLATES.default;
    const startDate = trip.startDate ? new Date(trip.startDate) : new Date();

    for (let i = 0; i < plan.length; i++) {
      const dayInfo = plan[i];
      const date = new Date(startDate);
      date.setDate(date.getDate() + i);
      const [day] = await db
        .insert(itineraryDay)
        .values({
          tripId: trip.tripId,
          dayIndex: i + 1,
          date: date.toISOString().slice(0, 10),
        })
        .returning();

      for (let j = 0; j < dayInfo.items.length; j++) {
        const it = dayInfo.items[j];
        await db.insert(itineraryItems).values({
          dayId: day.dayId,
          tripId: trip.tripId,
          customName: it.title,
          startTime: it.time,
          note: it.notes,
          orderIndex: j,
        } as any);
      }
    }
    seededCount++;
    console.log(`  ✅ Seeded "${trip.title}" — ${plan.length} day(s)`);
  }
  console.log(`\nDone. Seeded ${seededCount}/${myTrips.length} trip(s).`);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
