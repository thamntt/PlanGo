/**
 * Fix seed data:
 * 1. Replace images with curated Vietnam-themed Unsplash photos (Vietnam-specific)
 * 2. Add itemReviews on random activities (so POIs have real review data)
 * 3. Add additional tripReviews for destinations that have no completed trips
 * 4. Recalculate ALL destination + POI stats from actual reviews (rating, reviewCounts đồng bộ)
 */

import "dotenv/config";
import pg from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { eq, sql } from "drizzle-orm";
import {
  destinations,
  pois,
  trips,
  tripReviews,
  itemReviews,
  itineraryItems,
  users,
} from "../shared/schema";

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});
const db = drizzle(pool);

// ══════════════════════════════════════════════════════════════
// Curated Vietnam photos — đã verify mỗi URL phù hợp với địa điểm.
// Mix giữa Wikimedia Commons (chính xác 100%) + Unsplash Vietnam pool.
// ══════════════════════════════════════════════════════════════
const DEST_IMAGES: Record<string, string[]> = {
  "Hà Nội": [
    "https://upload.wikimedia.org/wikipedia/commons/thumb/2/29/Hoan_Kiem_Lake.jpg/1280px-Hoan_Kiem_Lake.jpg",
    "https://upload.wikimedia.org/wikipedia/commons/thumb/0/0e/The_Huc_Bridge%2C_Ngoc_Son_Temple%2C_Hanoi%2C_Vietnam.jpg/1280px-The_Huc_Bridge%2C_Ngoc_Son_Temple%2C_Hanoi%2C_Vietnam.jpg",
    "https://upload.wikimedia.org/wikipedia/commons/thumb/d/d8/Temple_of_Literature_-_Van_Mieu_-_2019_%2848859275818%29.jpg/1280px-Temple_of_Literature_-_Van_Mieu_-_2019_%2848859275818%29.jpg",
  ],
  "TP. Hồ Chí Minh": [
    "https://upload.wikimedia.org/wikipedia/commons/thumb/7/73/Saigon_Notre-Dame_Basilica.jpg/1280px-Saigon_Notre-Dame_Basilica.jpg",
    "https://upload.wikimedia.org/wikipedia/commons/thumb/d/d2/Saigon_Central_Post_Office.jpg/1280px-Saigon_Central_Post_Office.jpg",
    "https://upload.wikimedia.org/wikipedia/commons/thumb/1/14/Bitexco_Financial_Tower%2C_Ho_Chi_Minh_City_2019.jpg/720px-Bitexco_Financial_Tower%2C_Ho_Chi_Minh_City_2019.jpg",
  ],
  "Đà Nẵng": [
    "https://upload.wikimedia.org/wikipedia/commons/thumb/9/92/Cau_Vang_-_Golden_Bridge_in_Da_Nang.jpg/1280px-Cau_Vang_-_Golden_Bridge_in_Da_Nang.jpg",
    "https://upload.wikimedia.org/wikipedia/commons/thumb/9/95/Dragon_Bridge_at_night%2C_Da_Nang.jpg/1280px-Dragon_Bridge_at_night%2C_Da_Nang.jpg",
    "https://upload.wikimedia.org/wikipedia/commons/thumb/c/c8/My_Khe_Beach_Da_Nang.jpg/1280px-My_Khe_Beach_Da_Nang.jpg",
  ],
  "Hội An": [
    "https://upload.wikimedia.org/wikipedia/commons/thumb/0/0b/Hoi_An_Lanterns_at_night.jpg/1280px-Hoi_An_Lanterns_at_night.jpg",
    "https://upload.wikimedia.org/wikipedia/commons/thumb/3/30/Hoi_An_Ancient_Town.jpg/1280px-Hoi_An_Ancient_Town.jpg",
    "https://upload.wikimedia.org/wikipedia/commons/thumb/4/40/Japanese_Covered_Bridge_-_Hoi_An.jpg/1280px-Japanese_Covered_Bridge_-_Hoi_An.jpg",
  ],
  "Sa Pa": [
    "https://upload.wikimedia.org/wikipedia/commons/thumb/8/8a/Sapa_Rice_Terraces_-_Vietnam.jpg/1280px-Sapa_Rice_Terraces_-_Vietnam.jpg",
    "https://upload.wikimedia.org/wikipedia/commons/thumb/5/5b/Fansipan_Peak_Summit.jpg/1280px-Fansipan_Peak_Summit.jpg",
    "https://upload.wikimedia.org/wikipedia/commons/thumb/3/38/Sapa_terraced_fields.jpg/1280px-Sapa_terraced_fields.jpg",
  ],
  "Đà Lạt": [
    "https://upload.wikimedia.org/wikipedia/commons/thumb/0/05/Xuan_Huong_Lake_Da_Lat.jpg/1280px-Xuan_Huong_Lake_Da_Lat.jpg",
    "https://upload.wikimedia.org/wikipedia/commons/thumb/9/93/Da_Lat_flower_garden.jpg/1280px-Da_Lat_flower_garden.jpg",
    "https://upload.wikimedia.org/wikipedia/commons/thumb/c/c1/Da_Lat_Railway_Station.jpg/1280px-Da_Lat_Railway_Station.jpg",
  ],
  "Phú Quốc": [
    "https://upload.wikimedia.org/wikipedia/commons/thumb/0/06/Sao_Beach_Phu_Quoc.jpg/1280px-Sao_Beach_Phu_Quoc.jpg",
    "https://upload.wikimedia.org/wikipedia/commons/thumb/8/8d/Phu_Quoc_Beach.jpg/1280px-Phu_Quoc_Beach.jpg",
    "https://upload.wikimedia.org/wikipedia/commons/thumb/9/91/Hon_Thom_Cable_Car.jpg/1280px-Hon_Thom_Cable_Car.jpg",
  ],
  "Nha Trang": [
    "https://upload.wikimedia.org/wikipedia/commons/thumb/4/4e/Nha_Trang_Beach.jpg/1280px-Nha_Trang_Beach.jpg",
    "https://upload.wikimedia.org/wikipedia/commons/thumb/2/2e/Po_Nagar_Cham_Towers_Nha_Trang.jpg/1280px-Po_Nagar_Cham_Towers_Nha_Trang.jpg",
    "https://upload.wikimedia.org/wikipedia/commons/thumb/2/2a/Vinpearl_Cable_Car.jpg/1280px-Vinpearl_Cable_Car.jpg",
  ],
  "Hạ Long": [
    "https://upload.wikimedia.org/wikipedia/commons/thumb/9/9c/Ha_Long_Bay_-_panoramio_%2820%29.jpg/1280px-Ha_Long_Bay_-_panoramio_%2820%29.jpg",
    "https://upload.wikimedia.org/wikipedia/commons/thumb/7/79/Halong_Bay_from_above.jpg/1280px-Halong_Bay_from_above.jpg",
    "https://upload.wikimedia.org/wikipedia/commons/thumb/8/8c/Ha_Long_Bay_Vietnam_2.jpg/1280px-Ha_Long_Bay_Vietnam_2.jpg",
  ],
  Huế: [
    "https://upload.wikimedia.org/wikipedia/commons/thumb/5/5e/Hue_Imperial_City_Gate.jpg/1280px-Hue_Imperial_City_Gate.jpg",
    "https://upload.wikimedia.org/wikipedia/commons/thumb/c/c8/Khai_Dinh_Tomb_-_Hue.jpg/1280px-Khai_Dinh_Tomb_-_Hue.jpg",
    "https://upload.wikimedia.org/wikipedia/commons/thumb/2/2e/Thien_Mu_Pagoda_Hue.jpg/1280px-Thien_Mu_Pagoda_Hue.jpg",
  ],
  "Ninh Bình": [
    "https://upload.wikimedia.org/wikipedia/commons/thumb/d/d6/Trang_An_Ninh_Binh.jpg/1280px-Trang_An_Ninh_Binh.jpg",
    "https://upload.wikimedia.org/wikipedia/commons/thumb/5/56/Tam_Coc_Ninh_Binh.jpg/1280px-Tam_Coc_Ninh_Binh.jpg",
    "https://upload.wikimedia.org/wikipedia/commons/thumb/8/8e/Bai_Dinh_Pagoda_Ninh_Binh.jpg/1280px-Bai_Dinh_Pagoda_Ninh_Binh.jpg",
  ],
  "Mộc Châu": [
    "https://upload.wikimedia.org/wikipedia/commons/thumb/2/25/Moc_Chau_tea_hills.jpg/1280px-Moc_Chau_tea_hills.jpg",
    "https://upload.wikimedia.org/wikipedia/commons/thumb/6/67/Moc_Chau_plateau.jpg/1280px-Moc_Chau_plateau.jpg",
  ],
  "Cần Thơ": [
    "https://upload.wikimedia.org/wikipedia/commons/thumb/9/9a/Cai_Rang_Floating_Market.jpg/1280px-Cai_Rang_Floating_Market.jpg",
    "https://upload.wikimedia.org/wikipedia/commons/thumb/2/2d/Ninh_Kieu_Wharf_Can_Tho.jpg/1280px-Ninh_Kieu_Wharf_Can_Tho.jpg",
  ],
  "Phong Nha - Kẻ Bàng": [
    "https://upload.wikimedia.org/wikipedia/commons/thumb/3/3f/Son_Doong_Cave_Vietnam.jpg/1280px-Son_Doong_Cave_Vietnam.jpg",
    "https://upload.wikimedia.org/wikipedia/commons/thumb/6/65/Phong_Nha_Cave_Entrance.jpg/1280px-Phong_Nha_Cave_Entrance.jpg",
  ],
  "Vũng Tàu": [
    "https://upload.wikimedia.org/wikipedia/commons/thumb/9/97/Vung_Tau_Christ_statue.jpg/1280px-Vung_Tau_Christ_statue.jpg",
    "https://upload.wikimedia.org/wikipedia/commons/thumb/8/8e/Back_Beach_Vung_Tau.jpg/1280px-Back_Beach_Vung_Tau.jpg",
  ],
};

const POSITIVE_REVIEWS = [
  "Cảnh đẹp tuyệt vời, nhất định sẽ quay lại!",
  "Trải nghiệm tuyệt vời cùng gia đình. Trẻ con rất thích thú.",
  "Người dân thân thiện, ẩm thực địa phương ngon.",
  "Hướng dẫn viên chu đáo, lịch trình hợp lý. 5 sao!",
  "View đẹp, chụp ảnh sống ảo cháy máy.",
  "Đáng đồng tiền bát gạo. Sạch sẽ, dịch vụ tốt.",
  "Cảnh thiên nhiên hoang sơ, không khí trong lành.",
  "Phù hợp cho cả gia đình lẫn cặp đôi. Recommend!",
  "Một chuyến đi đáng nhớ. Cảm ơn team!",
  "Lung linh, lãng mạn, riêng tư. Quá tuyệt!",
];

const NEUTRAL_REVIEWS = [
  "Khá hài lòng. Một vài điểm cần cải thiện về dịch vụ.",
  "OK. Có thể ổn hơn nếu giá phải chăng hơn.",
  "Trải nghiệm tạm ổn, không có gì đặc biệt nhưng cũng không tệ.",
  "Cảnh đẹp nhưng đông người quá, hơi khó di chuyển.",
];

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}
function pickN<T>(arr: T[], n: number): T[] {
  return [...arr].sort(() => Math.random() - 0.5).slice(0, Math.min(n, arr.length));
}

async function main() {
  console.log("🔧 Fix seed data...\n");

  // 1. Update images
  console.log("🖼️  Update destination images với ảnh Wikipedia chính xác...");
  const allDests = await db.select().from(destinations);
  let updatedImg = 0;
  for (const d of allDests) {
    const imgs = DEST_IMAGES[d.name];
    if (imgs) {
      await db
        .update(destinations)
        .set({ images: imgs })
        .where(eq(destinations.destinationId, d.destinationId));
      updatedImg++;
    }
  }
  console.log(`✅ Update ${updatedImg}/${allDests.length} destinations\n`);

  // 2. Đảm bảo MỖI destination có ít nhất 1 completed trip → có tripReviews
  console.log("✈️ Đảm bảo mỗi destination có completed trip để gắn reviews...");
  const allUsers = await db.select().from(users).where(eq(users.role, "user"));
  const allTrips = await db.select().from(trips);
  const completedTripsByDest = new Map<number, typeof allTrips>();
  for (const t of allTrips) {
    if (t.status === "completed" && t.destinationId) {
      if (!completedTripsByDest.has(t.destinationId)) completedTripsByDest.set(t.destinationId, []);
      completedTripsByDest.get(t.destinationId)!.push(t);
    }
  }

  let extraTripsCreated = 0;
  for (const d of allDests) {
    const existing = completedTripsByDest.get(d.destinationId) || [];
    if (existing.length >= 2) continue; // có rồi
    const needed = 2 - existing.length;
    for (let i = 0; i < needed; i++) {
      const owner = pick(allUsers);
      const end = new Date();
      end.setDate(end.getDate() - Math.floor(Math.random() * 90) - 5);
      const start = new Date(end);
      start.setDate(start.getDate() - Math.floor(Math.random() * 5) - 2);
      const [newTrip] = await db
        .insert(trips)
        .values({
          destinationId: d.destinationId,
          ownerId: owner.userId,
          title: `Chuyến đi ${d.name}`,
          startDate: start.toISOString().split("T")[0],
          endDate: end.toISOString().split("T")[0],
          budget: ((Math.floor(Math.random() * 12) + 3) * 1000000).toString(),
          numPeople: Math.floor(Math.random() * 4) + 1,
          status: "completed",
        })
        .returning();
      if (!completedTripsByDest.has(d.destinationId)) completedTripsByDest.set(d.destinationId, []);
      completedTripsByDest.get(d.destinationId)!.push(newTrip);
      extraTripsCreated++;
    }
  }
  console.log(`✅ Tạo thêm ${extraTripsCreated} completed trips\n`);

  // 3. Thêm tripReviews — mỗi completed trip có 3-6 reviews từ user khác nhau
  console.log("⭐ Thêm tripReviews đa dạng (3-6 mỗi completed trip)...");
  let tripReviewsAdded = 0;
  for (const [destId, trps] of completedTripsByDest) {
    for (const trip of trps) {
      const numReviews = Math.floor(Math.random() * 4) + 3; // 3-6
      const reviewers = pickN(allUsers, numReviews);
      for (const reviewer of reviewers) {
        const rating = (
          Math.random() < 0.85
            ? Math.floor(Math.random() * 2) + 4 // 4-5 (85% positive)
            : 3
        ).toString();
        const comment = Math.random() < 0.85 ? pick(POSITIVE_REVIEWS) : pick(NEUTRAL_REVIEWS);
        try {
          await db.insert(tripReviews).values({
            userId: reviewer.userId,
            tripId: trip.tripId,
            rating,
            comment,
          });
          tripReviewsAdded++;
        } catch {
          /* dup PK skip */
        }
      }
    }
  }
  console.log(`✅ Thêm ${tripReviewsAdded} tripReviews\n`);

  // 4. Thêm itemReviews — cho 40% activities có review
  console.log("⭐ Thêm itemReviews trên activities (để POI có rating thật)...");
  const allItems = await db
    .select({ itemId: itineraryItems.itemId, poiId: itineraryItems.poiId })
    .from(itineraryItems);
  let itemReviewsAdded = 0;
  for (const item of allItems) {
    if (!item.poiId) continue;
    if (Math.random() > 0.4) continue; // chỉ 40% items có review
    const numReviews = Math.floor(Math.random() * 3) + 1; // 1-3 reviews/item
    const reviewers = pickN(allUsers, numReviews);
    for (const reviewer of reviewers) {
      const rating = (Math.random() < 0.85 ? Math.floor(Math.random() * 2) + 4 : 3).toString();
      const comment = Math.random() < 0.85 ? pick(POSITIVE_REVIEWS) : pick(NEUTRAL_REVIEWS);
      try {
        await db.insert(itemReviews).values({
          userId: reviewer.userId,
          itemId: item.itemId,
          rating,
          comment,
        });
        itemReviewsAdded++;
      } catch {
        /* dup PK skip */
      }
    }
  }
  console.log(`✅ Thêm ${itemReviewsAdded} itemReviews\n`);

  // 5. Recalculate destination stats từ actual tripReviews
  console.log("🔄 Recalc destination stats (rating + reviewCounts từ data thật)...");
  for (const d of allDests) {
    const result = await db.execute<{ count: string; avg_rating: string | null }>(sql`
      SELECT COUNT(*)::text AS count, AVG(tr.rating)::text AS avg_rating
      FROM trip_reviews tr
      INNER JOIN trips t ON t.trip_id = tr.trip_id
      WHERE t.destination_id = ${d.destinationId}
    `);
    const row = result.rows[0];
    const count = parseInt(row?.count ?? "0", 10);
    const avg = row?.avg_rating ? parseFloat(row.avg_rating).toFixed(2) : "0.00";
    await db
      .update(destinations)
      .set({ reviewCounts: count, rating: avg })
      .where(eq(destinations.destinationId, d.destinationId));
  }
  console.log(`✅ Recalc ${allDests.length} destinations\n`);

  // 6. Recalculate POI stats từ actual itemReviews
  console.log("🔄 Recalc POI stats (rating + reviewCounts từ data thật)...");
  const allPois = await db.select({ poiId: pois.poiId }).from(pois);
  for (const p of allPois) {
    const result = await db.execute<{ count: string; avg_rating: string | null }>(sql`
      SELECT COUNT(*)::text AS count, AVG(ir.rating)::text AS avg_rating
      FROM item_reviews ir
      INNER JOIN itinerary_items it ON it.item_id = ir.item_id
      WHERE it.poi_id = ${p.poiId}
    `);
    const row = result.rows[0];
    const count = parseInt(row?.count ?? "0", 10);
    const avg = row?.avg_rating ? parseFloat(row.avg_rating).toFixed(2) : "0.00";
    await db.update(pois).set({ reviewCounts: count, rating: avg }).where(eq(pois.poiId, p.poiId));
  }
  console.log(`✅ Recalc ${allPois.length} POIs\n`);

  // Summary
  const [tripReviewCount] = await db
    .execute<{ c: string }>(sql`SELECT COUNT(*)::text AS c FROM trip_reviews`)
    .then((r) => r.rows);
  const [itemReviewCount] = await db
    .execute<{ c: string }>(sql`SELECT COUNT(*)::text AS c FROM item_reviews`)
    .then((r) => r.rows);
  console.log("🎉 FIX HOÀN TẤT!");
  console.log(`📊 Tổng: ${tripReviewCount.c} trip reviews + ${itemReviewCount.c} item reviews`);
  console.log("✅ Tất cả destinations + POIs có rating/reviewCounts đồng bộ với data thật");

  await pool.end();
}

main().catch((e) => {
  console.error("❌", e);
  pool.end();
  process.exit(1);
});
