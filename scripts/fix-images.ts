/**
 * Replace all destination images with VERIFIED working Unsplash URLs.
 * Each ID đã được test (curl HEAD) trả về HTTP 200.
 */
import "dotenv/config";
import pg from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { eq } from "drizzle-orm";
import { destinations } from "../shared/schema";

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});
const db = drizzle(pool);

// 17 photo IDs đã verify HTTP 200 — toàn cảnh Vietnam/SE-Asia.
const POOL = [
  "1583417319070-4a69db38a482",
  "1559592413-7cec4d0cae2b",
  "1528127269322-539801943592",
  "1542359649-31e03cd4d909",
  "1583417267826-aebc4d1542e1",
  "1602002418082-a4443e081dd1",
  "1565967511849-76a60a516170",
  "1509316785289-025f5b846b35",
  "1496939376851-89342e90adcd",
  "1528181304800-259b08848526",
  "1538485399081-7191377e8241",
  "1540541338287-41700207dee6",
  "1504609813442-a8924e83f76e",
  "1576487248805-cf45f6bcc67f",
  "1555921015-5532091f6026",
  "1606918801925-e2c914c4b503",
  "1547981609-4b6bfe67ca0b",
];

function unsplash(id: string): string {
  return `https://images.unsplash.com/photo-${id}?w=1280&q=80&auto=format&fit=crop`;
}

// Assign best-fit pool indices per destination.
// IDs có theme phù hợp được gán cho destination tương ứng.
const ASSIGNMENTS: Record<string, number[]> = {
  "Hà Nội": [0, 5, 1], // city + lanterns
  "TP. Hồ Chí Minh": [5, 0, 12], // urban
  "Đà Nẵng": [4, 14, 11], // beach + coastal
  "Hội An": [1, 13, 16], // lanterns + ancient
  "Sa Pa": [2, 3, 10], // mountain/terraces
  "Đà Lạt": [3, 10, 15], // mountains/scenic
  "Phú Quốc": [4, 6, 14], // beach
  "Nha Trang": [4, 11, 14], // beach
  "Hạ Long": [2, 7, 8], // bay/water
  Huế: [9, 12, 13], // historic
  "Ninh Bình": [2, 10, 15], // karst/terraces
  "Mộc Châu": [3, 15, 10], // plateau
  "Cần Thơ": [8, 7, 13], // river
  "Phong Nha - Kẻ Bàng": [10, 3, 2], // caves/jungle
  "Vũng Tàu": [4, 6, 14], // beach
};

async function main() {
  console.log("🖼️  Update destination images với 17 Unsplash IDs đã verify...\n");
  const all = await db.select().from(destinations);
  let count = 0;
  for (const d of all) {
    const idxs = ASSIGNMENTS[d.name];
    if (!idxs) continue;
    const imgs = idxs.map((i) => unsplash(POOL[i]));
    await db
      .update(destinations)
      .set({ images: imgs })
      .where(eq(destinations.destinationId, d.destinationId));
    count++;
    console.log(`  ✓ ${d.name}`);
  }
  console.log(`\n✅ Update ${count}/${all.length} destinations với ảnh verified (HTTP 200)`);
  await pool.end();
}

main().catch((e) => {
  console.error(e);
  pool.end();
  process.exit(1);
});
