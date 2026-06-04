/**
 * Seed Vietnamese community content — blog posts + forum threads with replies,
 * linked to existing destinations + users. Run after main seed.
 *
 *   npx tsx scripts/seed-community.ts
 */
import "dotenv/config";
import pg from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { eq, sql } from "drizzle-orm";
import {
  users,
  destinations,
  blogPosts,
  blogPostTags,
  blogPostDestinations,
  blogLikes,
  blogComments,
  forumThreads,
  forumReplies,
  forumThreadTags,
  forumVotes,
  communityTags,
} from "../shared/schema";

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});
const db = drizzle(pool);

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}
function pickN<T>(arr: T[], n: number): T[] {
  return [...arr].sort(() => Math.random() - 0.5).slice(0, Math.min(n, arr.length));
}
function slug(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[đĐ]/g, "d")
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .slice(0, 260);
}

const TAGS = [
  { name: "Hướng dẫn", slug: "huong-dan", color: "#0891B2" },
  { name: "Review", slug: "review", color: "#10B981" },
  { name: "Ẩm thực", slug: "am-thuc", color: "#F97316" },
  { name: "Mẹo hay", slug: "meo-hay", color: "#8B5CF6" },
  { name: "Tiết kiệm", slug: "tiet-kiem", color: "#22C55E" },
  { name: "Sang chảnh", slug: "sang-chanh", color: "#D97706" },
  { name: "Solo", slug: "solo", color: "#0EA5E9" },
  { name: "Gia đình", slug: "gia-dinh", color: "#0891B2" },
  { name: "Cặp đôi", slug: "cap-doi", color: "#EC4899" },
  { name: "Phượt", slug: "phuot", color: "#EF4444" },
  { name: "Mùa hè", slug: "mua-he", color: "#F59E0B" },
  { name: "Mùa đông", slug: "mua-dong", color: "#3B82F6" },
];

const BLOG_POSTS: {
  destName: string;
  title: string;
  excerpt: string;
  content: string;
  category: "guide" | "review" | "food" | "tips" | "experience";
  tags: string[];
  readMinutes: number;
}[] = [
  {
    destName: "Hà Nội",
    title: "Cẩm nang 3N2Đ Hà Nội cho người mới đi lần đầu",
    excerpt:
      "Lịch trình tối ưu khám phá thủ đô — phố cổ, ẩm thực đường phố, văn hóa nghìn năm trong 3 ngày 2 đêm với chi phí dưới 4 triệu.",
    content: `# Cẩm nang 3N2Đ Hà Nội cho người mới đi lần đầu

## Ngày 1: Phố cổ + Hồ Gươm

**Buổi sáng** (8:00–11:30):
- Phở Thìn Lò Đúc — bữa sáng kinh điển với phở tái lăn (~75k/bát)
- Đi bộ ra Hồ Gươm, vào đền Ngọc Sơn qua cầu Thê Húc (vé 30k)
- Lượn 36 phố phường, dừng cafe trứng Giảng (~45k/ly)

**Buổi chiều** (13:00–17:30):
- Văn Miếu Quốc Tử Giám (vé 30k)
- Đi bộ qua Hoàng Thành Thăng Long
- Cafe Cộng phố Nhà Thờ — view nhà thờ Lớn

**Buổi tối**:
- Chả cá Lã Vọng (~200k/người)
- Đi bộ phố đi bộ Hồ Gươm cuối tuần

## Ngày 2: Hồ Tây + Bảo tàng

**Sáng**:
- Bún chả Hương Liên Lê Văn Hưu (Obama từng ăn, ~85k)
- Đạp xe Hồ Tây 1 vòng (thuê 50k/giờ)
- Chùa Trấn Quốc + đường Thanh Niên ngắm hoàng hôn

**Chiều**:
- Bảo tàng Dân tộc học (vé 40k)
- Ăn xôi Yến Nguyễn Hữu Huân (~50k)

**Tối**:
- Phố Tạ Hiện — bia hơi + nem chua rán
- Show "Tinh hoa Bắc Bộ" (option, vé ~600k)

## Ngày 3: Bát Tràng + Souvenir

- Bus 47 đi làng gốm Bát Tràng
- Tự nặn gốm, mua đồ lưu niệm
- Chiều về sân bay/ga

**Tổng chi phí** (ăn + di chuyển + vé tham quan): **~3.5 triệu/người** (chưa tính khách sạn)

**Tips**:
- Mua sim 4G ngay sân bay
- Dùng Grab xe máy cho di chuyển ngắn
- Tránh dịp lễ — đông + giá cao gấp 2`,
    category: "guide",
    tags: ["Hướng dẫn", "Tiết kiệm", "Mùa hè"],
    readMinutes: 12,
  },
  {
    destName: "Hà Nội",
    title: "10 quán cafe phải thử ở Hà Nội — từ cổ điển đến hiện đại",
    excerpt:
      "Từ cafe trứng Giảng cổ điển 1946 đến The Note Cafe đầy giấy nhớ — list 10 quán cafe huyền thoại của thủ đô.",
    content: `# 10 quán cafe Hà Nội must-try

## 1. Giảng Cafe — Cafe trứng 1946
Địa chỉ: 39 Nguyễn Hữu Huân
Cafe trứng nguyên bản, recipe gốc từ ông Nguyễn Văn Giảng (chef khách sạn Metropole những năm 40). Phục vụ trong tách nhỏ đặt trong bát nước nóng giữ ấm.
**Phải thử**: Cafe trứng nóng (45k)

## 2. The Note Cafe — Phố cổ
Địa chỉ: 64 Lương Văn Can
Quán nổi tiếng với hàng nghìn giấy nhớ dán khắp tường. Visiting card cho du khách viết lời nhắn.
**Phải thử**: Cafe cốt dừa (~60k)

## 3. Tranquil Books & Coffee — Yên tĩnh nhất phố cổ
Địa chỉ: 5 Nguyễn Quang Bích
Không gian gỗ ấm cúng, đầy sách. Perfect cho làm việc/đọc sách.
**Phải thử**: Espresso + bánh chocolate

## 4. Cafe Phố Cổ — View hồ Gươm
Địa chỉ: 11 Hàng Gai (lên tầng cao)
Cafe rooftop view trực tiếp Hồ Gươm. Đắt nhưng đáng.

## 5. Cộng Cafe Nhà Thờ
Theme bao cấp retro, decor đậm chất Hà Nội cũ.
**Phải thử**: Cafe muối, sữa chua cafe

(...còn 5 quán nữa trong bài đầy đủ)`,
    category: "food",
    tags: ["Ẩm thực", "Review"],
    readMinutes: 8,
  },
  {
    destName: "Đà Nẵng",
    title: "Đà Nẵng — Hội An 4N3Đ tự túc dưới 5 triệu/người",
    excerpt:
      "Trải nghiệm cá nhân: hành trình combo Đà Nẵng + Hội An 4 ngày với ngân sách tiết kiệm nhưng vẫn đầy đủ.",
    content: `# Đà Nẵng — Hội An 4N3Đ dưới 5 triệu

## Chi phí breakdown
- Vé bay khứ hồi (booking sớm 2 tháng): 1.2M
- Khách sạn 3* Đà Nẵng (3 đêm): 1.5M
- Ăn uống + cafe: 800k
- Vé tham quan + di chuyển: 700k
- Lưu niệm: 300k
**Tổng: ~4.5M/người**

## Ngày 1: Đà Nẵng — Bà Nà Hills
- Sáng: Bay đến Đà Nẵng, taxi về KS (~80k)
- Trưa: Mì Quảng Bà Mua (50k)
- Chiều: Cáp treo Bà Nà Hills (850k all-in)
- Tối: Cầu Rồng phun lửa (T7/CN 21h)

## Ngày 2: Bãi biển + Sơn Trà
- Bãi Mỹ Khê sáng sớm
- Bán đảo Sơn Trà — chùa Linh Ứng + tượng Phật Bà
- Tối: Phố ẩm thực Hoàng Sa hải sản

## Ngày 3: Hội An (day-trip)
- Xe bus công cộng 30 phút (~30k) hoặc Grab (~350k 1 chiều)
- Phố cổ Hội An vé 120k
- Bánh mì Phượng (40k) — ngon nhất VN
- Cao lầu Thanh (50k)
- Tối: thả đèn hoa đăng sông Hoài (20k/cái)

## Ngày 4: Nghỉ ngơi + về
- Bữa sáng bánh xèo Bà Dưỡng
- Lượn các quán cafe view biển
- Bay về

**Tips tiết kiệm**:
- Book combo flight+hotel trên Traveloka có giảm ~20%
- Đi xe bus thay Grab cho chặng dài
- Ăn quán địa phương thay khách sạn`,
    category: "guide",
    tags: ["Tiết kiệm", "Hướng dẫn", "Mùa hè"],
    readMinutes: 15,
  },
  {
    destName: "Đà Nẵng",
    title: "Top 10 quán hải sản Đà Nẵng — tươi rẻ tại nhà hàng địa phương",
    excerpt:
      "Bé Mặn, Mỹ Hạnh, Bà Thôi — list những quán hải sản ngon-rẻ-bổ mà ngay cả người Đà Nẵng cũng phải gật đầu.",
    content: `# Top 10 hải sản Đà Nẵng

## 1. Bé Mặn — Bãi Mỹ Khê
Địa chỉ: lô 14 Võ Nguyên Giáp
Nổi tiếng với ghẹ xanh + tôm tít. Giá ngang chợ.
**Must-try**: Ghẹ rang muối (~600k/kg), tôm tít hấp

## 2. Mỹ Hạnh — Mỹ An
Quán địa phương, view biển từ tầng 2.
**Must-try**: Mực một nắng nướng, ốc hương xào tỏi

## 3. Bà Thôi — Trần Văn Đang
Hải sản tươi từ tàu về buổi sáng.
**Must-try**: Cua biển hấp bia (~700k/kg)

(Còn 7 quán + tips chọn hải sản tươi)`,
    category: "food",
    tags: ["Ẩm thực", "Review"],
    readMinutes: 10,
  },
  {
    destName: "Hội An",
    title: "Đêm Hội An — thả đèn hoa đăng + 5 quán cafe view phố cổ",
    excerpt:
      "Hội An về đêm lung linh đèn lồng. Hướng dẫn thả đèn, show diễn, và 5 quán cafe view đẹp nhất.",
    content: `# Đêm Hội An — magic của phố cổ

## Thả đèn hoa đăng

**Khi nào**: Buổi tối 18:30 trở đi, lý tưởng nhất 19:00-21:00 (đông nhưng đẹp)
**Ở đâu**: Sông Hoài, hai bên có hàng chục thuyền + người bán đèn
**Giá**: 20-30k/đèn, nên thả 2-3 cái cho đẹp ảnh

**Mẹo chụp ảnh đẹp**:
- Đứng trên cầu An Hội nhìn xuống — view đẹp nhất
- Hoặc thuê thuyền nhỏ ra giữa sông
- Chế độ Night mode trên điện thoại
- ISO cao + tốc độ chậm cho DSLR

## Show diễn không thể bỏ qua

### Memories Show
- Địa điểm: Lune Performing Arts Theatre
- Giá vé: 600k-1.2M
- Thời lượng: 65 phút
- Câu chuyện về Hội An xưa qua múa + nhạc dân tộc

### Ấn tượng Hội An
- Show ngoài trời với hàng nghìn diễn viên
- Vé: 1.2M-2M

## 5 quán cafe view phố cổ

(... tiếp nội dung)`,
    category: "experience",
    tags: ["Review", "Cặp đôi"],
    readMinutes: 7,
  },
  {
    destName: "Sa Pa",
    title: "Sa Pa trekking mùa lúa chín — kinh nghiệm 3N2Đ",
    excerpt:
      "Trekking Cát Cát, Tả Van, Lao Chải mùa vàng. Thuê porter, ngủ homestay, ăn thắng cố — full experience.",
    content: `# Trekking Sa Pa mùa lúa chín

## Khi nào đi?
**Tháng 9-10**: Lúa chín vàng — đẹp nhất năm. Ngày nắng, đêm se lạnh.

## Lịch trình 3N2Đ

### Ngày 1: Hà Nội → Sa Pa → Cát Cát
- Tàu hỏa SP3 (giường nằm) đêm: 350k
- Sáng đến Lào Cai → bus lên Sa Pa (1h, 50k)
- Check-in homestay Tả Van
- Chiều: trekking Cát Cát (~5km, 3h)

### Ngày 2: Lao Chải → Tả Van trekking
- Trekking 12km qua các bản — guide địa phương 500k/ngày
- Ăn trưa với người Mông tại homestay
- Chiều: thăm ruộng bậc thang Mường Hoa

### Ngày 3: Fansipan + về
- Cáp treo Fansipan 800k
- Xuống núi chiều, tàu đêm về HN

## Chi phí
- Trekking guide + porter: 1M
- Homestay 2 đêm: 600k
- Ăn uống: 500k
- Cáp treo: 800k
- Tàu khứ hồi: 700k
**Tổng: ~3.6M/người**

## Đồ cần mang
- Giày trekking chống nước
- Áo gió + áo ấm (đêm 10-15°C)
- Đèn pin, sạc dự phòng
- Thuốc say độ cao (nếu nhạy)`,
    category: "guide",
    tags: ["Hướng dẫn", "Phượt", "Mùa thu"],
    readMinutes: 14,
  },
  {
    destName: "Đà Lạt",
    title: "Đà Lạt cho cặp đôi — 5 góc check-in lãng mạn nhất",
    excerpt:
      "Cánh đồng hoa cẩm tú cầu, đồi chè Cầu Đất, Linh Quy Pháp Ấn — list spot photogenic chuẩn pre-wedding.",
    content: `# Đà Lạt — paradise cho cặp đôi

## 1. Cánh đồng cẩm tú cầu
- Địa điểm: Trại Mát, cách trung tâm 8km
- Tháng 5-9: hoa nở rộ
- Vé vào: 50k
- Tips: Đi sớm 6h để né đông + ánh sáng đẹp

## 2. Đồi chè Cầu Đất
- Cách trung tâm 25km về phía Đông Nam
- Buổi sáng sương mù tạo không khí mộng mơ
- Cafe Mê Linh ngay chỗ đồi chè

## 3. Linh Quy Pháp Ấn — Cổng trời
- Bảo Lộc, cách Đà Lạt 80km
- View tuyệt đẹp lúc bình minh
- Đi từ 4h sáng

(... còn 2 spot nữa)`,
    category: "guide",
    tags: ["Cặp đôi", "Hướng dẫn"],
    readMinutes: 9,
  },
  {
    destName: "Phú Quốc",
    title: "Phú Quốc 4N3Đ all-in dưới 6 triệu — vé combo + tour",
    excerpt:
      "Bãi Sao + Hòn Thơm cáp treo + Vinpearl Safari. Lịch trình tối ưu cho gia đình và cặp đôi.",
    content: `# Phú Quốc 4N3Đ — combo tiết kiệm

## Combo tour all-in
Nếu mua combo trên Klook/Booking:
- Vé bay + KS 3* + tour đảo: ~5.5M
- Tự túc rời rạc: ~7M

→ Combo TIẾT KIỆM ~20%

## Lịch trình mẫu

### Ngày 1: Đến + Bãi Sao
- Bay tới Phú Quốc (~1.5h từ HN/SG)
- Check-in KS Long Beach
- Chiều: Bãi Sao tắm biển

### Ngày 2: Tour 4 đảo nam
- Cáp treo Hòn Thơm 700k
- Lặn ngắm san hô (gear free)
- Câu cá

### Ngày 3: Vinpearl Safari + VinWonders
- Combo 1.5M
- Cả ngày chơi

### Ngày 4: Chợ đêm + về
- Sáng: massage Phú Quốc Pearl
- Chiều: chợ đêm Dinh Cậu mua hải sản khô
- Bay về

**Lưu ý**:
- Đi tháng 11-3 đẹp nhất (khô)
- Tránh tháng 7-9 (mưa nhiều)`,
    category: "guide",
    tags: ["Gia đình", "Hướng dẫn", "Mùa đông"],
    readMinutes: 11,
  },
  {
    destName: "Hạ Long",
    title: "Du thuyền vịnh Hạ Long — so sánh 3 hãng top hiện tại",
    excerpt:
      "Paradise vs Heritage vs Indochina Sails — giá, trải nghiệm, phòng, ăn uống. Booking giảm giá ở đâu?",
    content: `# Du thuyền Hạ Long — comparison

## Paradise Elegance
- Giá: 4.5M/người 2N1Đ
- 5 sao, phòng có ban công
- Bar cocktail
- Massage on-board

## Heritage Cruise (Bình Chuẩn)
- Giá: 6M/người
- Theme cổ điển 1925
- Hành trình dài Cát Bà
- Restaurant cao cấp

## Indochina Sails
- Giá: 3.8M/người
- 4 sao, value for money
- Cabin gỗ truyền thống

## Tips booking
- Klook Lunar New Year sale giảm 40%
- Tránh tháng 7-8 (mưa + bão)
- Best: Tháng 3-5 và 10-11`,
    category: "review",
    tags: ["Review", "Sang chảnh"],
    readMinutes: 10,
  },
  {
    destName: "Hà Nội",
    title: "Solo Hà Nội — bản đồ tâm hồn cho người đi 1 mình",
    excerpt:
      "1 tuần ở Hà Nội solo: tìm chính mình ở phố cổ, viết nhật ký bên Hồ Tây, cafe sách góc phố.",
    content: `# Solo Hà Nội — week of soul-searching

## Tại sao Hà Nội phù hợp solo?
- Nhịp sống chậm hơn Sài Gòn
- Nhiều cafe yên tĩnh để đọc/viết
- An toàn cho phụ nữ solo
- Văn hóa cafe đậm nét

## Itinerary 7 ngày

### Ngày 1-2: Phố cổ
Lạc ở 36 phố phường, không cần plan
- Ngủ homestay trong ngõ
- Sáng cafe, chiều đi bộ, tối ăn vỉa hè

### Ngày 3: Hồ Tây
Đạp xe quanh hồ, dừng chùa Trấn Quốc
- Cafe Maison de Tet decor
- Viết nhật ký bên hồ

### Ngày 4: Bảo tàng
- Dân tộc học (cả ngày)
- Mỹ thuật VN
- Phụ nữ VN

### Ngày 5: Ngoại ô
- Làng Đường Lâm (50km)
- Đền Và

(...)`,
    category: "experience",
    tags: ["Solo", "Cảm xúc"],
    readMinutes: 8,
  },
];

const FORUM_THREADS: {
  destName?: string;
  title: string;
  body: string;
  category: "question" | "discussion" | "tip" | "recommendation";
  tags: string[];
  replies: { body: string; isAccepted?: boolean }[];
}[] = [
  {
    destName: "Đà Nẵng",
    title: "Đà Nẵng tháng 10 có mưa nhiều không?",
    body: "Mình book chuyến giữa tháng 10 (đi 4N3Đ), sợ gặp mưa cả tuần thì hỏng chuyến. Mọi người có kinh nghiệm gì không? Có nên đổi sang tháng khác hay vẫn ổn?",
    category: "question",
    tags: ["Mùa hè"],
    replies: [
      {
        body: "Mình đi tháng 10 năm ngoái, mưa rải rác nhưng không nặng. Thường mưa buổi chiều 1-2h rồi nắng lại. Mang theo áo mưa nhẹ là OK. Lợi điểm: ít đông, giá KS giảm 30%!",
        isAccepted: true,
      },
      {
        body: "Tháng 10 là cuối mùa du lịch, vẫn đẹp. Tránh đi giữa-cuối tháng 10 vì có thể có bão. Đầu tháng OK nhất.",
      },
      {
        body: "Có app dự báo bão miền Trung khá chính xác, check trước khi đi 1 tuần.",
      },
    ],
  },
  {
    destName: "Hà Nội",
    title: "Khách sạn nào view Hồ Gươm dưới 1.5tr/đêm?",
    body: "Mình cần phòng có view trực tiếp Hồ Gươm, không cần 5 sao nhưng sạch sẽ + gần trung tâm để tiện đi bộ. Budget 1.5M/đêm cho 2 người. Ai có gợi ý không?",
    category: "question",
    tags: ["Hướng dẫn", "Gia đình"],
    replies: [
      {
        body: "Hanoi Le Carnot Hotel — 1.2M/đêm, view side hồ. Đi 50m là tới hồ. Mình ở 2 lần rồi, recommend.",
        isAccepted: true,
      },
      {
        body: "Apricot Hotel cao cấp hơn nhưng phải bookin sớm. Best view Hồ Gươm.",
      },
      {
        body: "Tip: Search trên Agoda app vào ngày thường (T2-T5) giảm 20-30%.",
      },
    ],
  },
  {
    destName: "Sa Pa",
    title: "Sa Pa tháng 12 lạnh tới mức nào? Có tuyết không?",
    body: "Mình từ miền Nam lên, sợ lạnh. Tháng 12 ở Sa Pa nhiệt độ bao nhiêu? Có cần mua áo dày hay mặc mỏng + áo gió là đủ?",
    category: "question",
    tags: ["Mùa đông"],
    replies: [
      {
        body: "Tháng 12 ở Sa Pa: ban ngày 5-12°C, đêm 0-5°C. Lạnh thật! Cần áo dày + áo gió + găng tay + khăn quàng. Mua sẵn ở Hà Nội rẻ hơn.",
        isAccepted: true,
      },
      {
        body: "Tuyết có rất hiếm, chỉ vài năm 1 lần (2016, 2021). Sương muối thì hay có. Đỉnh Fansipan có thể có tuyết nhẹ.",
      },
      {
        body: "Nếu nhạy lạnh thật, tránh tháng 12. Đi tháng 9-10 đẹp hơn (lúa chín + thời tiết dễ chịu).",
      },
    ],
  },
  {
    destName: "Hội An",
    title: "May đo áo dài Hội An mất bao lâu? Quán nào ngon?",
    body: "Mình chỉ có 2 ngày ở Hội An, muốn may 1 bộ áo dài để mặc đêm phố cổ. Có quán nào giao trong 24h không? Chất lượng OK?",
    category: "question",
    tags: ["Mẹo hay", "Cặp đôi"],
    replies: [
      {
        body: "Yaly Couture — 6h là xong basic, 24h là perfect fit. Giá 800k-1.5M tùy chất liệu. Khuyên đi đo sáng ngày 1, lấy chiều ngày 2.",
        isAccepted: true,
      },
      {
        body: "BeBe Tailor cũng tốt, giá rẻ hơn (500k-1M), 12h xong.",
      },
    ],
  },
  {
    destName: "Phú Quốc",
    title: "Phú Quốc đi mùa nào ít mưa nhất?",
    body: "Mình book vé tháng 8, có nên đổi sang tháng khác không? Nghe nói tháng 8 mùa mưa.",
    category: "question",
    tags: ["Mùa hè"],
    replies: [
      {
        body: "Tháng 8 đúng mùa mưa Phú Quốc — mưa rải rác cả ngày, biển động. Đổi sang tháng 11-3 (mùa khô) sẽ tốt hơn nhiều.",
        isAccepted: true,
      },
      {
        body: "Nếu không đổi được, vẫn có thể đi nhưng plan B: spa, chợ đêm, vinwonders indoor.",
      },
    ],
  },
  {
    destName: "Đà Lạt",
    title: "Cuối tuần Đà Lạt có quá đông không?",
    body: "Mình muốn không khí yên tĩnh, đi T7-CN có ổn không hay nên đi giữa tuần? Lo bị đông + kẹt xe.",
    category: "question",
    tags: ["Cặp đôi"],
    replies: [
      {
        body: "T7-CN Đà Lạt đông gấp 3-4 lần ngày thường! Khách Sài Gòn lên rất nhiều. Nếu muốn yên tĩnh, GO T3-T5.",
        isAccepted: true,
      },
      {
        body: "Cuối tuần các spot famous (Linh Quy Pháp Ấn, đồi chè) phải xếp hàng 30-60 phút chụp ảnh.",
      },
    ],
  },
  {
    destName: "Hà Nội",
    title: "Có nên đi tàu hỏa Hà Nội — Sa Pa thay vì xe khách?",
    body: "Nghe nói tàu chậm hơn nhưng êm hơn, ngủ ngon hơn. Mọi người trải nghiệm thế nào? Giá vé bao nhiêu?",
    category: "question",
    tags: ["Phượt", "Tiết kiệm"],
    replies: [
      {
        body: "Tàu giường nằm cabin 4: 350-500k/người, êm + ngủ ngon. Xe khách 200-300k nhưng giật + lắc, dễ say. Mình prefer tàu.",
        isAccepted: true,
      },
      {
        body: "Tip: Mua vé cabin VIP (cabin 2) nếu đi cặp đôi — riêng tư + sạch hơn. ~750k/người.",
      },
      {
        body: "Tàu SP3 (đêm) là phổ biến nhất. Xuất phát 21:35 HN, đến Lào Cai 5h sáng.",
      },
    ],
  },
  {
    destName: "Hạ Long",
    title: "Cruise Hạ Long có say sóng không?",
    body: "Mình hơi nhạy với say sóng. Vịnh Hạ Long sóng êm nhưng vẫn lo. Có thuốc gì để chuẩn bị?",
    category: "question",
    tags: ["Mẹo hay", "Sang chảnh"],
    replies: [
      {
        body: "Vịnh Hạ Long sóng rất êm vì là vịnh kín, gần như không thấy lắc. Trừ ngày bão. 95% người không say sóng.",
        isAccepted: true,
      },
      {
        body: "Mang theo Dramamine hoặc miếng dán Scopolamine sau tai để chắc ăn. Mua ở pharmacy.",
      },
    ],
  },
  {
    destName: undefined,
    title: "Mua sim 4G du lịch Việt Nam — nhà mạng nào tốt nhất?",
    body: "Tới VN du lịch 2 tuần, đi 4-5 tỉnh. Nên mua sim của Viettel, Vinaphone hay Mobifone? Gói nào worth?",
    category: "tip",
    tags: ["Mẹo hay"],
    replies: [
      {
        body: "Viettel có phủ sóng tốt nhất, đặc biệt vùng núi (Sa Pa, Đà Lạt). Gói TOMV120: 60GB/tháng + 1000 phút gọi, 120k. Mua ở sân bay convenient nhưng đắt hơn 50%.",
        isAccepted: true,
      },
      {
        body: "Mobifone signal tốt ở miền Trung. Vinaphone OK ở miền Nam.",
      },
    ],
  },
  {
    destName: undefined,
    title: "Khi nào nên book vé máy bay nội địa giá rẻ?",
    body: "Mọi người thường book vé Vietjet/Bamboo bao nhiêu ngày trước? Có pattern giảm giá không?",
    category: "discussion",
    tags: ["Tiết kiệm", "Mẹo hay"],
    replies: [
      {
        body: "Best timing: 2-3 tháng trước cho mùa cao điểm (Tết, hè). 1-2 tháng cho mùa thấp. Vietjet thường khuyến mãi 8h sáng T6.",
        isAccepted: true,
      },
      {
        body: "Đăng ký newsletter của các hãng — họ gửi flash sale 0đ (chỉ tax 100-200k) thỉnh thoảng.",
      },
      {
        body: "Skyscanner + Google Flights để track giá. Set alert khi giá thấp nhất.",
      },
    ],
  },
  // ─── Unanswered threads (chưa có ai trả lời — demo filter "Chưa trả lời") ───
  {
    destName: "Đà Nẵng",
    title: "Cuối tuần Đà Nẵng có quán cafe nào yên tĩnh để work từ xa?",
    body: "Mình đi công tác Đà Nẵng 5 ngày, cần làm việc remote buổi sáng. Cần wifi mạnh + ổn định, không quá ồn, ổ cắm. Ai biết quán nào recommend giúp mình với?",
    category: "recommendation",
    tags: ["Mẹo hay"],
    replies: [],
  },
  {
    destName: "Phú Quốc",
    title: "Phú Quốc tháng 9 lặn ngắm san hô được không?",
    body: "Mình book Phú Quốc đầu tháng 9. Đọc trên mạng thấy nói mùa biển động, không lặn được. Có ai từng đi tháng 9 chia sẻ thực tế không?",
    category: "question",
    tags: ["Mùa hè"],
    replies: [],
  },
  {
    destName: "Hội An",
    title: "Đặt cyclo Hội An ban đêm — chỗ nào đẹp + giá bao nhiêu?",
    body: "Mình muốn trải nghiệm cyclo xuyên phố cổ buổi tối với bạn gái. Mọi người chia sẻ giá thuê + tuyến đường nào view đèn lồng đẹp nhất?",
    category: "recommendation",
    tags: ["Cặp đôi"],
    replies: [],
  },
  {
    title: "Vé tàu Bắc - Nam giường nằm có còn không? Đặt đâu?",
    body: "Mình muốn đi tàu Hà Nội - Sài Gòn (SE3 hoặc SE5) giường nằm khoang 4, có thể đặt trước bao lâu? Đặt trên dsvn.vn an toàn không?",
    category: "question",
    tags: ["Hướng dẫn"],
    replies: [],
  },
  {
    destName: "Sa Pa",
    title: "Trek Fansipan mùa mưa có an toàn không? Cần guide không?",
    body: "Mình muốn trek đỉnh Fansipan thay vì đi cáp treo, dự kiến tháng 7. Có ai từng trek mùa mưa? An toàn không, cần thuê guide địa phương không?",
    category: "discussion",
    tags: ["Phượt"],
    replies: [],
  },
];

async function main() {
  console.log("🌱 Seed community content (blog + forum)...\n");

  // 1. Clean existing community data
  console.log("🧹 Xóa data cũ...");
  await db.delete(blogLikes);
  await db.delete(blogComments);
  await db.delete(blogPostDestinations);
  await db.delete(blogPostTags);
  await db.delete(blogPosts);
  await db.delete(forumVotes);
  await db.delete(forumReplies);
  await db.delete(forumThreadTags);
  await db.delete(forumThreads);
  await db.delete(communityTags);

  // 2. Seed tags
  console.log("🏷️  Tạo tags...");
  const tagMap = new Map<string, number>();
  for (const t of TAGS) {
    const [created] = await db.insert(communityTags).values(t).returning();
    tagMap.set(t.name, created.tagId);
  }

  // 3. Load users + destinations
  const allUsers = await db.select().from(users).where(eq(users.role, "user"));
  const allDests = await db.select().from(destinations);
  const destByName = new Map(allDests.map((d) => [d.name, d]));

  if (allUsers.length === 0) {
    console.log("⚠️  No users found — please run main seed first");
    await pool.end();
    return;
  }

  // 4. Seed blog posts
  console.log(`📝 Tạo ${BLOG_POSTS.length} blog posts...`);
  let totalLikes = 0;
  let totalComments = 0;
  for (const bp of BLOG_POSTS) {
    const dest = destByName.get(bp.destName);
    const author = pick(allUsers);
    const slugStr = `${slug(bp.title)}-${Math.floor(Math.random() * 9000) + 1000}`;
    const cover =
      dest?.images?.[0] || "https://images.unsplash.com/photo-1559592413-7cec4d0cae2b?w=900";
    const [post] = await db
      .insert(blogPosts)
      .values({
        authorId: author.userId,
        title: bp.title,
        slug: slugStr,
        excerpt: bp.excerpt,
        content: bp.content,
        coverImage: cover,
        category: bp.category,
        readMinutes: bp.readMinutes,
        status: "published",
      })
      .returning();

    if (dest) {
      await db
        .insert(blogPostDestinations)
        .values({ postId: post.postId, destinationId: dest.destinationId });
    }
    const tagIds = bp.tags.map((n) => tagMap.get(n)).filter((id): id is number => !!id);
    if (tagIds.length) {
      await db.insert(blogPostTags).values(tagIds.map((tagId) => ({ postId: post.postId, tagId })));
      for (const tagId of tagIds) {
        await db
          .update(communityTags)
          .set({ usageCount: sql`${communityTags.usageCount} + 1` })
          .where(eq(communityTags.tagId, tagId));
      }
    }

    // Random likes (3-20)
    const likers = pickN(allUsers, Math.floor(Math.random() * 18) + 3);
    for (const liker of likers) {
      try {
        await db.insert(blogLikes).values({ postId: post.postId, userId: liker.userId });
        totalLikes++;
      } catch {}
    }
    await db
      .update(blogPosts)
      .set({
        likeCount: likers.length,
        viewCount: Math.floor(Math.random() * 500) + 50,
      })
      .where(eq(blogPosts.postId, post.postId));

    // Random comments (0-5)
    const commenters = pickN(allUsers, Math.floor(Math.random() * 5));
    const sampleComments = [
      "Bài viết rất chi tiết, cảm ơn bạn!",
      "Mình sắp đi, recommend này rất useful!",
      "Có thể chia sẻ thêm về phương tiện di chuyển không?",
      "Tiết kiệm quá! Mình tham khảo nhé.",
      "Hình ảnh đẹp + content chất lượng. Follow!",
      "Đúng cái mình cần. Save lại để đọc lại.",
      "Quán bạn nói có còn mở không? Bạn đi cách đây bao lâu?",
    ];
    for (const c of commenters) {
      await db.insert(blogComments).values({
        postId: post.postId,
        authorId: c.userId,
        content: pick(sampleComments),
      });
      totalComments++;
    }
    if (commenters.length > 0) {
      await db
        .update(blogPosts)
        .set({ commentCount: commenters.length })
        .where(eq(blogPosts.postId, post.postId));
    }
  }
  console.log(`✅ ${BLOG_POSTS.length} posts + ${totalLikes} likes + ${totalComments} comments\n`);

  // 5. Seed forum threads + replies
  console.log(`💬 Tạo ${FORUM_THREADS.length} forum threads...`);
  let totalReplies = 0;
  let totalVotes = 0;
  for (const ft of FORUM_THREADS) {
    const dest = ft.destName ? destByName.get(ft.destName) : null;
    const author = pick(allUsers);
    const [thread] = await db
      .insert(forumThreads)
      .values({
        authorId: author.userId,
        title: ft.title,
        body: ft.body,
        destinationId: dest?.destinationId || null,
        category: ft.category,
        status: ft.replies.some((r) => r.isAccepted) ? "solved" : "open",
        viewCount: Math.floor(Math.random() * 300) + 20,
        lastReplyAt: new Date(),
      })
      .returning();

    const tagIds = ft.tags.map((n) => tagMap.get(n)).filter((id): id is number => !!id);
    if (tagIds.length) {
      await db
        .insert(forumThreadTags)
        .values(tagIds.map((tagId) => ({ threadId: thread.threadId, tagId })));
    }

    // Insert replies
    let acceptedId: number | null = null;
    for (const rd of ft.replies) {
      const replyAuthor = pick(allUsers.filter((u) => u.userId !== author.userId));
      const [reply] = await db
        .insert(forumReplies)
        .values({
          threadId: thread.threadId,
          authorId: replyAuthor.userId,
          body: rd.body,
          upvotes: rd.isAccepted
            ? Math.floor(Math.random() * 12) + 5
            : Math.floor(Math.random() * 5),
        })
        .returning();
      if (rd.isAccepted) acceptedId = reply.replyId;
      totalReplies++;
    }
    if (acceptedId) {
      await db
        .update(forumThreads)
        .set({ acceptedReplyId: acceptedId, status: "solved" })
        .where(eq(forumThreads.threadId, thread.threadId));
    }
    await db
      .update(forumThreads)
      .set({
        replyCount: ft.replies.length,
        upvotes: Math.floor(Math.random() * 25) + 5,
      })
      .where(eq(forumThreads.threadId, thread.threadId));

    // Random votes on thread
    const voters = pickN(allUsers, Math.floor(Math.random() * 8) + 2);
    for (const v of voters) {
      try {
        await db.insert(forumVotes).values({
          userId: v.userId,
          targetType: "thread",
          targetId: thread.threadId,
          voteType: Math.random() < 0.9 ? "up" : "down",
        });
        totalVotes++;
      } catch {}
    }
  }
  console.log(
    `✅ ${FORUM_THREADS.length} threads + ${totalReplies} replies + ${totalVotes} votes\n`,
  );

  console.log("🎉 SEED COMMUNITY DONE!");
  console.log(`📊 Tổng:`);
  console.log(`   - ${BLOG_POSTS.length} blog posts`);
  console.log(`   - ${totalLikes} likes`);
  console.log(`   - ${totalComments} comments`);
  console.log(`   - ${FORUM_THREADS.length} forum threads`);
  console.log(`   - ${totalReplies} replies`);
  console.log(`   - ${totalVotes} votes`);
  console.log(`   - ${TAGS.length} tags`);

  await pool.end();
}

main().catch((e) => {
  console.error("❌ Seed failed:", e);
  pool.end();
  process.exit(1);
});
