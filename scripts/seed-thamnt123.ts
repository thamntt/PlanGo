/**
 * Seed extra data for account `thamnt123` for manual testing:
 *  - Several blog posts authored by them
 *  - A few forum threads
 *  - Other users following them
 *  - They follow other users
 *
 * Run: npx tsx scripts/seed-thamnt123.ts
 */
import "dotenv/config";
import { db } from "../server/db";
import {
  users,
  blogPosts,
  blogPostDestinations,
  blogPostTags,
  blogLikes,
  blogComments,
  communityTags,
  forumThreads,
  forumReplies,
  userFollows,
  destinations,
} from "../shared/schema";
import { eq, and, sql, inArray } from "drizzle-orm";

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}
function rint(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

const THAM_BLOG_POSTS = [
  {
    title: "Solo Hà Giang 5N4Đ — cung đường vòng tròn QL4C",
    excerpt:
      "Hành trình một mình từ Hà Nội chinh phục cao nguyên đá. Mã Pì Lèng, Lũng Cú, Đồng Văn — chi tiết lịch trình + chi phí.",
    content: `# Hà Giang solo 5N4Đ

Mình đi tháng 10 — mùa hoa tam giác mạch nở rộ. Cung đường vòng tròn QL4C qua các điểm chính.

## Ngày 1: Hà Nội → Hà Giang
- Xe khách giường nằm tối ngủ trên xe
- 7h sáng tới TP Hà Giang
- Thuê xe máy Honda Wave 110: 200k/ngày

## Ngày 2: TP Hà Giang → Yên Minh → Đồng Văn
- Dừng ngắm Cổng trời Quản Bạ
- Trưa ăn tại Yên Minh
- Tối ngủ Đồng Văn — homestay 150k/đêm

## Ngày 3: Đồng Văn → Mã Pì Lèng → Mèo Vạc
- Đỉnh điểm của chuyến đi
- Đèo Mã Pì Lèng quá đỉnh, sông Nho Quế xanh ngọc
- Thuê thuyền 100k đi sông Nho Quế

## Ngày 4: Mèo Vạc → cột cờ Lũng Cú
- Cực Bắc Tổ Quốc
- Chụp ảnh cờ đỏ sao vàng

## Tổng chi phí: ~3.5tr

## Lời khuyên
- Mang áo ấm — đêm cao nguyên 10-15°C
- Đổ xăng đầy mỗi sáng (cây xăng ít)
- Tải sẵn bản đồ offline`,
    category: "story",
    tags: ["Solo", "Phượt", "Mùa thu"],
    readMinutes: 12,
    destName: "Hà Giang",
    coverImage: "https://images.unsplash.com/photo-1545158539-26773c2c7f3c?w=1280&q=80",
  },
  {
    title: "Review chi tiết Vinpearl Phú Quốc — có đáng tiền 5 sao?",
    excerpt:
      "Mình ở 3 đêm tại Vinpearl Resort. Phòng, ăn uống, dịch vụ, vé Vinwonders + Safari kèm gói. Đánh giá thật.",
    content: `# Vinpearl Phú Quốc — review thật

Đặt qua Agoda gói 3N2Đ all-inclusive: 8.5tr/2 người.

## Phòng
- Phòng Deluxe Garden View
- Sạch, thoáng, ban công view vườn
- Wifi mạnh, TV cable đầy đủ

## Ăn uống
- Buffet sáng đa dạng (Á + Âu + đặc sản miền Tây)
- Đồ uống tại các quầy free
- Buffet tối lobster 1.5tr/người (ko bao)

## Vé Vinwonders + Safari
- Đã bao trong gói
- Mất nguyên 1 ngày — đi Safari sáng + Vinwonders chiều
- Cá nhân ấn tượng Safari hơn

## Pros
- Phòng đẹp, dịch vụ pro
- Có Safari + Vinwonders đi kèm
- Xe đưa đón sân bay miễn phí

## Cons
- Đồ uống ngoài bữa giá đắt (cafe 80k)
- Bãi biển khu vực này ko đẹp = Bãi Sao
- Đông khách dịp lễ

## Kết luận: 7.5/10, đáng tiền nếu có Safari kèm`,
    category: "review",
    tags: ["Review", "Sang chảnh", "Gia đình"],
    readMinutes: 10,
    destName: "Phú Quốc",
    coverImage: "https://images.unsplash.com/photo-1540541338287-41700207dee6?w=1280&q=80",
  },
  {
    title: "Top 7 quán phở ngon nhất Hà Nội theo dân địa phương",
    excerpt:
      "Phở Thìn, Bát Đàn, Lò Đúc, Sướng... — list quán phở mình ăn nhiều năm, chỉ nơi nào worth.",
    content: `# Phở Hà Nội — guide từ dân địa phương

## 1. Phở Bát Đàn — phở bò chuẩn vị cổ
- 49 Bát Đàn, Hoàn Kiếm
- Mở 6h - 22h
- Phở tái 50k, gầu 60k
- Xếp hàng tự lấy bát

## 2. Phở Thìn 13 Lò Đúc
- 13 Lò Đúc, Hai Bà Trưng
- Phở bò sốt vang đặc biệt
- Khá đắt: 80-90k/bát
- Nhưng worth — hương vị độc

## 3. Phở Lý Quốc Sư
- Phố Lý Quốc Sư
- Nước dùng đậm, thịt mềm
- 55k/bát

## 4. Phở Sướng
- 4 Mai Hắc Đế
- Phở gà ngon
- 60k

## 5. Phở Bưởi
- 12 Lê Ngọc Hân
- Nước trong, thanh
- 50k

## 6. Phở Vui (Phở Bò)
- 25 Hàng Giấy
- Phở bò ngọt vị xương
- 55k

## 7. Phở 10 Lý Quốc Sư
- 10 Lý Quốc Sư
- Tươi sáng
- 55k

## Tips
- Đi sáng sớm để có phở ngon nhất
- Mang khăn giấy riêng (quán không có)
- Thử các loại tái, gầu, nạm để biết quán đỉnh chỗ nào`,
    category: "food",
    tags: ["Ẩm thực", "Hà Nội"],
    readMinutes: 8,
    destName: "Hà Nội",
    coverImage: "https://images.unsplash.com/photo-1583224994076-ae7f1ceec5be?w=1280&q=80",
  },
  {
    title: "Đà Lạt 3N2Đ cặp đôi — lịch trình lãng mạn dưới 3tr",
    excerpt: "Cafe view đẹp, dinh thự cổ, đồi chè, cánh đồng hoa. Budget hợp lý cho đôi sinh viên.",
    content: `# Đà Lạt cặp đôi 3N2Đ — full guide

## Chi phí tổng: 2.8tr/người

## Ngày 1: Tới Đà Lạt
- Xe Phương Trang Sài Gòn → Đà Lạt: 230k/người
- Check-in homestay Mộc 700k/đêm
- Chiều dạo Hồ Xuân Hương, cafe Mê Linh Coffee Garden

## Ngày 2: Tour ngoài thành
- Sáng: Đồi chè Cầu Đất (cafe ngắm sương)
- Trưa: Buffet Đà Lạt 200k/người
- Chiều: Linh Quy Pháp Ấn (cổng trời)
- Tối: chợ Đêm Đà Lạt

## Ngày 3: Trong thành phố
- Cánh đồng hoa Vạn Thành
- Dinh I (vé 30k)
- Chợ Đà Lạt mua quà
- Xe đêm về

## Ăn uống chú ý
- Lẩu gà lá é Tao Ngộ: 200k/2 người
- Bánh tráng nướng cô Hoa
- Sữa đậu nành Hòa Bình

## Tips
- Đặt homestay sớm — cuối tuần đắt 1.5x
- Thuê xe máy: 150k/ngày
- Nhiệt độ 15-22°C — mang áo gió`,
    category: "guide",
    tags: ["Cặp đôi", "Hướng dẫn"],
    readMinutes: 7,
    destName: "Đà Lạt",
    coverImage: "https://images.unsplash.com/photo-1583417319070-4a69db38a482?w=1280&q=80",
  },
  {
    title: "Mẹo book vé máy bay nội địa giảm 40-60%",
    excerpt: "Kinh nghiệm 5 năm săn vé. Khi nào nên book, ứng dụng nào, code voucher hidden.",
    content: `# Săn vé máy bay rẻ — bí kíp 5 năm

## Khi nào book
- **Vietjet/Bamboo:** 1.5-3 tháng trước
- **Vietnam Airlines:** 2-4 tuần trước (giảm trễ)
- **Tránh:** Lễ Tết, hè (giá cao gấp 3)

## Ứng dụng tốt nhất
1. **Skyscanner** — so sánh tất cả hãng
2. **Google Flights** — track giá + alert
3. **App Vietjet** — flash sale 0đ mỗi 3PM

## Mẹo
- **Vé 1 chiều** thường rẻ hơn 2 chiều cộng lại
- Book đêm khuya 0h-3h (server giảm load)
- Đăng ký newsletter các hãng — nhận voucher 20-50%
- Voucher banks (TPBank, VPBank...) giảm thêm 10-15%

## Cảnh báo
- Vé "siêu rẻ" tax phí có thể 200-300k
- Hành lý ký gửi: thêm 200-400k/lượt
- Đổi vé Vietjet: phí 600k
- Đọc kỹ điều khoản trước khi đặt`,
    category: "tip",
    tags: ["Mẹo hay", "Tiết kiệm"],
    readMinutes: 5,
    coverImage: "https://images.unsplash.com/photo-1436491865332-7a61a109cc05?w=1280&q=80",
  },
];

const THAM_FORUM_THREADS = [
  {
    title: "Đi Hà Giang xe máy mùa mưa có an toàn không?",
    body: "Mình định đi cuối tháng 9. Đọc tin thấy có sạt lở. Có bạn nào đi mùa này chia sẻ không? Cần lưu ý gì?",
    category: "question",
    tags: ["Phượt", "Mùa hè"],
    destName: "Hà Giang",
  },
  {
    title: "Cần app dịch tiếng Anh offline tốt nhất cho du lịch nước ngoài",
    body: "Sắp đi Thái Lan, không có data 4G mọi lúc. App nào dịch giọng nói + camera offline tốt?",
    category: "recommendation",
    tags: ["Mẹo hay"],
  },
  {
    title: "Sa Pa tháng 12 đi cáp treo Fansipan có cần đặt trước?",
    body: "Đi 23/12, cuối tuần đông không? Đặt trước qua app hay mua tại quầy rẻ hơn?",
    category: "question",
    tags: ["Mùa đông"],
    destName: "Sa Pa",
  },
];

async function main() {
  console.log("🌱 Seed extra data cho account thamnt123...\n");

  // 1. Find thamnt123 user
  const [tham] = await db.select().from(users).where(eq(users.userName, "thamnt123"));
  if (!tham) {
    console.error("❌ Không tìm thấy user thamnt123. Đăng ký tài khoản này trước.");
    process.exit(1);
  }
  console.log(`✅ Found thamnt123 (userId=${tham.userId})\n`);

  // 2. Find other users to be followers / followees
  const otherUsers = await db
    .select({ userId: users.userId, userName: users.userName })
    .from(users)
    .where(sql`${users.userId} != ${tham.userId}`);
  if (otherUsers.length < 5) {
    console.warn("⚠️ Cần thêm user khác để tạo follow data");
  }
  console.log(`Found ${otherUsers.length} users khác\n`);

  // 3. Find destinations
  const dests = await db.select().from(destinations);
  const destByName = new Map(dests.map((d) => [d.name, d]));

  // 4. Find tags
  const tags = await db.select().from(communityTags);
  const tagByName = new Map(tags.map((t) => [t.name, t.tagId]));

  // 5. Seed blog posts
  console.log("📝 Tạo blog posts cho thamnt123...");
  let postsCreated = 0;
  for (const post of THAM_BLOG_POSTS) {
    const dest = post.destName ? destByName.get(post.destName) : null;
    const slug = `${post.title
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/đ/g, "d")
      .replace(/[^a-z0-9\s-]/g, "")
      .replace(/\s+/g, "-")
      .slice(0, 200)}-${Date.now().toString(36).slice(-4)}-${rint(100, 999)}`;

    const [created] = await db
      .insert(blogPosts)
      .values({
        authorId: tham.userId,
        title: post.title,
        slug,
        excerpt: post.excerpt,
        content: post.content,
        coverImage: post.coverImage,
        category: post.category,
        readMinutes: post.readMinutes,
        status: "published",
        viewCount: rint(80, 600),
        publishedAt: new Date(),
      })
      .returning();

    if (dest) {
      await db.insert(blogPostDestinations).values({
        postId: created.postId,
        destinationId: dest.destinationId,
      });
    }

    const tagIds = post.tags
      .map((n) => tagByName.get(n))
      .filter((id): id is number => id !== undefined);
    for (const tagId of tagIds) {
      await db.insert(blogPostTags).values({ postId: created.postId, tagId });
    }

    // Add some likes from other users
    const likeCount = Math.min(otherUsers.length, rint(3, 12));
    const likers = [...otherUsers].sort(() => Math.random() - 0.5).slice(0, likeCount);
    for (const liker of likers) {
      await db
        .insert(blogLikes)
        .values({ postId: created.postId, userId: liker.userId })
        .onConflictDoNothing();
    }
    await db.update(blogPosts).set({ likeCount }).where(eq(blogPosts.postId, created.postId));

    // Add 1-3 comments
    const commentCount = rint(1, 4);
    const commenters = [...otherUsers].sort(() => Math.random() - 0.5).slice(0, commentCount);
    const sampleComments = [
      "Bài hay quá! Cảm ơn bạn chia sẻ.",
      "Mình cũng vừa đi tuần trước, đồng ý hoàn toàn!",
      "Cho hỏi mùa nào đi đẹp nhất nhỉ?",
      "Lưu lại để áp dụng sau, thanks bạn!",
      "Bài chi tiết, đúng cái mình đang tìm.",
    ];
    for (const c of commenters) {
      await db.insert(blogComments).values({
        postId: created.postId,
        authorId: c.userId,
        content: pick(sampleComments),
      });
    }
    await db.update(blogPosts).set({ commentCount }).where(eq(blogPosts.postId, created.postId));

    postsCreated++;
    console.log(
      `   ✓ ${post.title.slice(0, 50)}... (${likeCount} likes, ${commentCount} comments)`,
    );
  }
  console.log(`✅ ${postsCreated} blog posts created\n`);

  // 6. Seed forum threads
  console.log("💬 Tạo forum threads cho thamnt123...");
  let threadsCreated = 0;
  for (const t of THAM_FORUM_THREADS) {
    const dest = t.destName ? destByName.get(t.destName) : null;
    const [created] = await db
      .insert(forumThreads)
      .values({
        authorId: tham.userId,
        title: t.title,
        body: t.body,
        destinationId: dest?.destinationId || null,
        category: t.category,
        status: "open",
        viewCount: rint(30, 200),
        lastReplyAt: new Date(),
      })
      .returning();

    // 0-3 replies from other users
    const replyCount = rint(0, 3);
    if (replyCount > 0) {
      const replies = [
        "Mình từng đi, theo kinh nghiệm thì bạn nên...",
        "Tùy mùa nha bạn, mùa này thì ổn.",
        "Mình sẽ chia sẻ chi tiết qua DM.",
      ];
      const repliers = [...otherUsers].sort(() => Math.random() - 0.5).slice(0, replyCount);
      for (const r of repliers) {
        await db.insert(forumReplies).values({
          threadId: created.threadId,
          authorId: r.userId,
          body: pick(replies),
        });
      }
      await db
        .update(forumThreads)
        .set({ replyCount })
        .where(eq(forumThreads.threadId, created.threadId));
    }

    threadsCreated++;
    console.log(`   ✓ ${t.title.slice(0, 50)}... (${replyCount} replies)`);
  }
  console.log(`✅ ${threadsCreated} forum threads created\n`);

  // 7. Seed follows
  console.log("👥 Tạo follow data...");

  // Have ~70% of other users follow thamnt123
  const followerCount = Math.min(otherUsers.length, Math.floor(otherUsers.length * 0.7));
  const followers = [...otherUsers].sort(() => Math.random() - 0.5).slice(0, followerCount);
  for (const f of followers) {
    await db
      .insert(userFollows)
      .values({ followerId: f.userId, followedId: tham.userId })
      .onConflictDoNothing();
  }
  console.log(`   ✓ ${followers.length} users đang theo dõi thamnt123`);

  // Have thamnt123 follow ~5 random users
  const followingCount = Math.min(otherUsers.length, 5);
  const following = [...otherUsers].sort(() => Math.random() - 0.5).slice(0, followingCount);
  for (const f of following) {
    await db
      .insert(userFollows)
      .values({ followerId: tham.userId, followedId: f.userId })
      .onConflictDoNothing();
  }
  console.log(`   ✓ thamnt123 đang theo dõi ${following.length} users\n`);

  console.log("🎉 DONE!");
  console.log(`📊 Tổng cho thamnt123:`);
  console.log(`   - ${postsCreated} blog posts`);
  console.log(`   - ${threadsCreated} forum threads`);
  console.log(`   - ${followers.length} followers`);
  console.log(`   - ${following.length} following`);

  process.exit(0);
}

main().catch((err) => {
  console.error("❌ Error:", err);
  process.exit(1);
});
