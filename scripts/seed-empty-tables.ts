/**
 * Seed all currently empty tables with realistic, logically-connected data:
 *  - expensetype (lookup)
 *  - trip_members (existing trips get co-travelers)
 *  - trip_preferences (each trip has 2-4 preferences)
 *  - review_votes (helpful/not-helpful on existing tripReviews)
 *  - review_replies (1-2 replies per review)
 *  - content_reports (some pending reports for admin demo)
 *  - review_categories (Airbnb-style 5-category breakdown)
 *  - blog_bookmarks (users bookmark posts)
 *  - expenses (trips get expense items)
 *  - expense_splits (expenses split among members)
 *  - notes (notes on expenses + itinerary items)
 *
 * Run: npx tsx scripts/seed-empty-tables.ts
 */
import "dotenv/config";
import pg from "pg";

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}
function pickN<T>(arr: T[], n: number): T[] {
  return [...arr].sort(() => Math.random() - 0.5).slice(0, Math.min(n, arr.length));
}
function rint(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
function rfloat(min: number, max: number, decimals = 2): number {
  return parseFloat((Math.random() * (max - min) + min).toFixed(decimals));
}

async function main() {
  const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });

  console.log("🌱 Seeding empty tables...\n");

  // ─── 1. expense_type ───────────────────────────────────────
  console.log("💰 expense_type...");
  const expenseTypes = [
    { name: "Ăn uống", description: "Bữa ăn, đồ uống, snack" },
    { name: "Di chuyển", description: "Xe khách, taxi, grab, máy bay, tàu" },
    { name: "Lưu trú", description: "Khách sạn, homestay, hostel" },
    { name: "Vé tham quan", description: "Vé vào cửa địa điểm, tour" },
    { name: "Mua sắm", description: "Quà lưu niệm, đặc sản" },
    { name: "Hoạt động", description: "Spa, massage, water sport" },
    { name: "Khác", description: "Phí phát sinh khác" },
  ];
  for (const t of expenseTypes) {
    await pool.query(
      `INSERT INTO expensetype (name, description) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
      [t.name, t.description],
    );
  }
  const expTypeRows = (
    await pool.query(`SELECT expense_type_id FROM expensetype ORDER BY expense_type_id`)
  ).rows;
  console.log(`   ✓ ${expTypeRows.length} expense types`);

  // ─── Helper queries ───────────────────────────────────────
  const users = (await pool.query(`SELECT user_id FROM users WHERE role = 'user' OR role IS NULL`))
    .rows;
  const trips = (
    await pool.query(`SELECT trip_id, owner_id, start_date, end_date FROM trips ORDER BY trip_id`)
  ).rows;
  const prefs = (await pool.query(`SELECT preference_id FROM preferences`)).rows;
  const items = (await pool.query(`SELECT item_id, day_id FROM itinerary_items`)).rows;
  const days = (await pool.query(`SELECT day_id, trip_id FROM itineraryday`)).rows;
  const reviews = (await pool.query(`SELECT user_id, trip_id FROM trip_reviews`)).rows;
  const posts = (await pool.query(`SELECT post_id, author_id FROM blog_posts`)).rows;
  const forumThreads = (await pool.query(`SELECT thread_id, author_id FROM forum_threads`)).rows;

  if (users.length === 0 || trips.length === 0) {
    console.error("❌ Need users + trips first");
    process.exit(1);
  }

  // ─── 2. trip_members ──────────────────────────────────────
  console.log("\n👥 trip_members...");
  let tmCount = 0;
  for (const trip of trips) {
    // Owner is implicit; add 1-4 additional members
    const memberCount = rint(1, 4);
    const others = users.filter((u) => u.user_id !== trip.owner_id);
    if (others.length === 0) continue;
    const chosen = pickN(others, memberCount);
    for (const m of chosen) {
      const role = pick(["member", "co-organizer", "member", "member"]);
      try {
        await pool.query(
          `INSERT INTO trip_members (trip_id, user_id, role) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`,
          [trip.trip_id, m.user_id, role],
        );
        tmCount++;
      } catch {}
    }
  }
  console.log(`   ✓ ${tmCount} trip members`);

  // ─── 3. trip_preferences ──────────────────────────────────
  console.log("\n🎯 trip_preferences...");
  let tpCount = 0;
  for (const trip of trips) {
    const chosen = pickN(prefs, rint(2, 4));
    for (const p of chosen) {
      try {
        await pool.query(
          `INSERT INTO trip_preferences (trip_id, preference_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
          [trip.trip_id, p.preference_id],
        );
        tpCount++;
      } catch {}
    }
  }
  console.log(`   ✓ ${tpCount} trip preferences`);

  // ─── 4. review_votes ──────────────────────────────────────
  console.log("\n👍 review_votes...");
  let rvCount = 0;
  for (const rev of reviews) {
    const voters = pickN(
      users.filter((u) => u.user_id !== rev.user_id),
      rint(2, 8),
    );
    for (const v of voters) {
      // 75% helpful, 25% not_helpful
      const voteType = Math.random() < 0.75 ? "helpful" : "not_helpful";
      try {
        await pool.query(
          `INSERT INTO review_votes (review_user_id, review_trip_id, voter_user_id, vote_type) VALUES ($1, $2, $3, $4) ON CONFLICT DO NOTHING`,
          [rev.user_id, rev.trip_id, v.user_id, voteType],
        );
        rvCount++;
      } catch {}
    }
  }
  console.log(`   ✓ ${rvCount} review votes`);

  // ─── 5. review_replies ────────────────────────────────────
  console.log("\n💬 review_replies...");
  const replyTemplates = [
    "Cảm ơn bạn đã chia sẻ! Mình cũng vừa đi và đồng quan điểm.",
    "Mình nghĩ giá hơi cao so với chất lượng. Bạn có recommend chỗ nào rẻ hơn không?",
    "Bài đánh giá chi tiết, hữu ích quá!",
    "Khu này mùa nào đi đẹp nhất hả bạn?",
    "Mình từng ở đó cuối tuần — đông kinh khủng. Đi T2-T5 tốt hơn.",
    "Cảm ơn review. Mình sẽ tham khảo để lên kế hoạch đi tháng sau.",
    "Có chỗ gửi xe ở gần không bạn?",
  ];
  let rrCount = 0;
  for (const rev of reviews) {
    if (Math.random() < 0.4) continue; // 60% reviews get replies
    const replyCount = rint(1, 3);
    for (let i = 0; i < replyCount; i++) {
      const author = pick(users.filter((u) => u.user_id !== rev.user_id));
      try {
        await pool.query(
          `INSERT INTO review_replies (parent_review_user_id, parent_review_trip_id, author_id, content) VALUES ($1, $2, $3, $4)`,
          [rev.user_id, rev.trip_id, author.user_id, pick(replyTemplates)],
        );
        rrCount++;
      } catch {}
    }
  }
  console.log(`   ✓ ${rrCount} review replies`);

  // ─── 6. content_reports ───────────────────────────────────
  console.log("\n🚩 content_reports...");
  const reasons = ["spam", "misinformation", "harassment", "offensive", "illegal", "other"];
  const reportDetails: Record<string, string[]> = {
    spam: ["Bài quảng cáo dịch vụ", "Đăng nhiều bài giống nhau", "Chỉ chứa link affiliate"],
    misinformation: [
      "Giá ghi sai thực tế",
      "Địa điểm đã đóng cửa từ lâu",
      "Thông tin về dịch vụ không đúng",
    ],
    harassment: ["Tấn công cá nhân tác giả khác", "Bình luận mang tính xúc phạm"],
    offensive: ["Nội dung phản cảm", "Có hình ảnh không phù hợp"],
    illegal: ["Hướng dẫn vi phạm pháp luật", "Quảng cáo tour không phép"],
    other: ["Nội dung không liên quan du lịch", "Cần xem lại"],
  };
  let crCount = 0;
  // Reports on blog posts
  const blogToReport = pickN(posts, Math.floor(posts.length * 0.3));
  for (const p of blogToReport) {
    const reporters = pickN(
      users.filter((u) => u.user_id !== p.author_id),
      rint(1, 3),
    );
    for (const r of reporters) {
      const reason = pick(reasons);
      try {
        await pool.query(
          `INSERT INTO content_reports (content_type, content_ref_id, reporter_id, reason, details, status) VALUES ($1, $2, $3, $4, $5, $6)`,
          [
            "blog",
            String(p.post_id),
            r.user_id,
            reason,
            pick(reportDetails[reason] || ["—"]),
            "pending",
          ],
        );
        crCount++;
      } catch {}
    }
  }
  // Reports on forum threads
  const ftToReport = pickN(forumThreads, Math.floor(forumThreads.length * 0.25));
  for (const t of ftToReport) {
    const reporters = pickN(
      users.filter((u) => u.user_id !== t.author_id),
      rint(1, 2),
    );
    for (const r of reporters) {
      const reason = pick(reasons);
      try {
        await pool.query(
          `INSERT INTO content_reports (content_type, content_ref_id, reporter_id, reason, details, status) VALUES ($1, $2, $3, $4, $5, $6)`,
          [
            "forum_thread",
            String(t.thread_id),
            r.user_id,
            reason,
            pick(reportDetails[reason] || ["—"]),
            "pending",
          ],
        );
        crCount++;
      } catch {}
    }
  }
  // A few already-resolved reports
  const blogResolved = pickN(posts, 3);
  for (const p of blogResolved) {
    const r = pick(users);
    const reason = pick(reasons);
    try {
      await pool.query(
        `INSERT INTO content_reports (content_type, content_ref_id, reporter_id, reason, details, status) VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          "blog",
          String(p.post_id),
          r.user_id,
          reason,
          pick(reportDetails[reason] || ["—"]),
          pick(["resolved", "dismissed"]),
        ],
      );
      crCount++;
    } catch {}
  }
  console.log(`   ✓ ${crCount} content reports (pending + resolved)`);

  // ─── 7. review_categories ─────────────────────────────────
  console.log("\n⭐ review_categories...");
  const cats = ["experience", "value", "cleanliness", "safety", "service"];
  let rcCount = 0;
  for (const rev of reviews) {
    for (const cat of cats) {
      // each cat rated 3.0-5.0
      const rating = rfloat(3.0, 5.0, 1);
      try {
        await pool.query(
          `INSERT INTO review_categories (review_user_id, review_trip_id, category_name, rating) VALUES ($1, $2, $3, $4) ON CONFLICT DO NOTHING`,
          [rev.user_id, rev.trip_id, cat, rating],
        );
        rcCount++;
      } catch {}
    }
  }
  console.log(`   ✓ ${rcCount} review categories`);

  // ─── 8. blog_bookmarks ────────────────────────────────────
  console.log("\n🔖 blog_bookmarks...");
  let bbCount = 0;
  for (const u of users) {
    const bookmarked = pickN(posts, rint(2, 6));
    for (const p of bookmarked) {
      try {
        await pool.query(
          `INSERT INTO blog_bookmarks (post_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
          [p.post_id, u.user_id],
        );
        bbCount++;
      } catch {}
    }
  }
  // Update bookmark_count on posts
  await pool.query(
    `UPDATE blog_posts bp SET bookmark_count = (SELECT count(*) FROM blog_bookmarks WHERE post_id = bp.post_id)`,
  );
  console.log(`   ✓ ${bbCount} bookmarks`);

  // ─── 9. expenses ──────────────────────────────────────────
  console.log("\n💸 expenses...");
  const expenseDescriptions: Record<string, string[]> = {
    "Ăn uống": [
      "Bữa trưa tại quán phở",
      "Bữa tối nhà hàng hải sản",
      "Cafe sáng",
      "Buffet trưa",
      "Lẩu gà ác",
      "Bún bò Huế",
      "Bánh mì + cafe",
      "Đặc sản địa phương",
    ],
    "Di chuyển": [
      "Vé xe khách Hà Nội - Đà Nẵng",
      "Taxi từ sân bay về khách sạn",
      "Grab di chuyển trong ngày",
      "Thuê xe máy 1 ngày",
      "Vé tàu hỏa giường nằm",
      "Cáp treo lên đỉnh",
    ],
    "Lưu trú": [
      "Khách sạn 2 đêm",
      "Homestay gia đình",
      "Resort beachfront 1 đêm",
      "Hostel dorm bed",
    ],
    "Vé tham quan": [
      "Vé vào di tích lịch sử",
      "Vé combo công viên giải trí",
      "Tour 1 ngày",
      "Vé tham quan bảo tàng",
      "Vé thuyền đi vịnh",
    ],
    "Mua sắm": ["Quà lưu niệm gia đình", "Đặc sản mang về", "Áo thun in tên địa danh"],
    "Hoạt động": ["Spa thư giãn", "Massage chân", "Lặn ngắm san hô"],
    Khác: ["Phí giặt là", "Mua thuốc", "Tip cho hướng dẫn viên"],
  };
  const expRows: { expense_id: number; trip_id: number; amount: number; paid_by: number }[] = [];
  for (const trip of trips) {
    const expCount = rint(5, 15);
    const members = (
      await pool.query(`SELECT user_id FROM trip_members WHERE trip_id = $1`, [trip.trip_id])
    ).rows;
    const memberIds = [trip.owner_id, ...members.map((m) => m.user_id)];
    const tripDays = days.filter((d) => d.trip_id === trip.trip_id);
    const tripItems = items.filter((i) => tripDays.some((d) => d.day_id === i.day_id));

    for (let i = 0; i < expCount; i++) {
      const expType = pick(expTypeRows);
      const typeName = expenseTypes.find(
        (et) =>
          expTypeRows.findIndex((r) => r.expense_type_id === expType.expense_type_id) ===
          expTypeRows.findIndex((r) => r.expense_type_id === expType.expense_type_id),
      )?.name;
      // get type name by index
      const typeIdx = expTypeRows.findIndex((r) => r.expense_type_id === expType.expense_type_id);
      const tname = expenseTypes[typeIdx]?.name || "Khác";
      const descs = expenseDescriptions[tname] || ["Chi phí phát sinh"];
      const amount =
        tname === "Lưu trú"
          ? rfloat(500000, 2500000, 0)
          : tname === "Di chuyển"
            ? rfloat(50000, 800000, 0)
            : tname === "Vé tham quan"
              ? rfloat(50000, 500000, 0)
              : tname === "Ăn uống"
                ? rfloat(50000, 400000, 0)
                : tname === "Mua sắm"
                  ? rfloat(100000, 800000, 0)
                  : rfloat(50000, 300000, 0);
      const paidBy = pick(memberIds);
      const itemId = tripItems.length > 0 && Math.random() < 0.4 ? pick(tripItems).item_id : null;
      const splitMethod = pick(["equal", "equal", "equal", "by_payer"]);
      const r = await pool.query(
        `INSERT INTO expenses (trip_id, item_id, paid_by, expense_type_id, amount, description, split_method) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING expense_id`,
        [trip.trip_id, itemId, paidBy, expType.expense_type_id, amount, pick(descs), splitMethod],
      );
      expRows.push({
        expense_id: r.rows[0].expense_id,
        trip_id: trip.trip_id,
        amount,
        paid_by: paidBy,
      });
    }
  }
  console.log(`   ✓ ${expRows.length} expenses`);

  // ─── 10. expense_splits ───────────────────────────────────
  console.log("\n✂️  expense_splits...");
  let esCount = 0;
  for (const exp of expRows) {
    // Get members for this trip
    const tripMemberIds = (
      await pool.query(
        `SELECT user_id FROM trip_members WHERE trip_id = $1 UNION SELECT owner_id AS user_id FROM trips WHERE trip_id = $1`,
        [exp.trip_id],
      )
    ).rows.map((r) => r.user_id);
    if (tripMemberIds.length === 0) continue;
    const perPerson = parseFloat((exp.amount / tripMemberIds.length).toFixed(2));
    for (const uid of tripMemberIds) {
      try {
        await pool.query(
          `INSERT INTO expense_splits (expense_id, user_id, amount) VALUES ($1, $2, $3)`,
          [exp.expense_id, uid, perPerson],
        );
        esCount++;
      } catch {}
    }
  }
  console.log(`   ✓ ${esCount} expense splits`);

  // ─── 11. notes ────────────────────────────────────────────
  console.log("\n📝 notes...");
  const noteTemplates = [
    "Nhớ đặt bàn trước, cuối tuần đông",
    "Quán này nhân viên thân thiện, đồ ăn ngon",
    "Lưu ý đường hơi khó tìm, nên dùng Google Maps",
    "Có giảm giá cho khách đoàn",
    "Mở cửa muộn tới 22h",
    "Nên đi sáng sớm để tránh đông",
    "Phòng có view biển rất đẹp",
    "Wifi mạnh, có thể work remote",
    "Khu vực giữ xe miễn phí ngay cạnh",
    "Nhớ mặc đồ kín đáo khi vào chùa",
  ];
  let nCount = 0;
  // Notes on some expenses
  const expsForNotes = pickN(expRows, Math.floor(expRows.length * 0.3));
  for (const exp of expsForNotes) {
    await pool.query(`INSERT INTO notes (expense_id, user_id, content) VALUES ($1, $2, $3)`, [
      exp.expense_id,
      exp.paid_by,
      pick(noteTemplates),
    ]);
    nCount++;
  }
  // Notes on some itinerary items
  const itemsForNotes = pickN(items, Math.floor(items.length * 0.25));
  for (const it of itemsForNotes) {
    const owner = (
      await pool.query(
        `SELECT t.owner_id FROM itineraryday d JOIN trips t ON d.trip_id = t.trip_id WHERE d.day_id = $1`,
        [it.day_id],
      )
    ).rows[0]?.owner_id;
    if (!owner) continue;
    await pool.query(`INSERT INTO notes (item_id, user_id, content) VALUES ($1, $2, $3)`, [
      it.item_id,
      owner,
      pick(noteTemplates),
    ]);
    nCount++;
  }
  console.log(`   ✓ ${nCount} notes`);

  console.log("\n🎉 DONE — all previously empty tables now have data");
  await pool.end();
  process.exit(0);
}

main().catch((err) => {
  console.error("❌ Error:", err);
  process.exit(1);
});
