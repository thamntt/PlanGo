/**
 * Mock community content per destination — used by destination detail page.
 * When Phase 2 blog + Phase 3 forum ship, replace with API calls keyed by
 * destination_id. Lookup here is by destination NAME (robust against DB id
 * resets during dev).
 */

export interface BlogPost {
  id: string;
  destName: string;
  title: string;
  excerpt: string;
  coverImage: string;
  authorName: string;
  authorAvatar: string;
  readMinutes: number;
  likes: number;
  publishedAt: string;
  category: "guide" | "review" | "food" | "tips";
}

export interface TripTemplate {
  id: string;
  destName: string;
  title: string;
  description: string;
  coverImage: string;
  numDays: number;
  numPeople: number;
  budgetVnd: number;
  rating: number;
  usedByCount: number;
  tags: string[];
}

export interface QAThread {
  id: string;
  destName: string;
  question: string;
  preview: string;
  authorName: string;
  authorAvatar: string;
  answerCount: number;
  upvotes: number;
  isAnswered: boolean;
  createdAt: string;
}

const img = (id: string) =>
  `https://images.unsplash.com/photo-${id}?w=600&q=80&auto=format&fit=crop`;
const avatar = (n: number) => `https://i.pravatar.cc/200?img=${n}`;

// ──────────────────────────────────────────────────────────────
// BLOG POSTS
// ──────────────────────────────────────────────────────────────

export const MOCK_BLOG_POSTS: BlogPost[] = [
  // Hà Nội
  {
    id: "b-hn-1",
    destName: "Hà Nội",
    title: "36 phố phường Hà Nội: hành trình ẩm thực & văn hóa",
    excerpt:
      "Khám phá phố cổ Hà Nội qua những con phố mang tên nghề thủ công xưa. Phở Thìn, bún chả Hương Liên, chả cá Lã Vọng — must-try!",
    coverImage: img("1559592413-7cec4d0cae2b"),
    authorName: "Nguyễn Thị Thắm",
    authorAvatar: avatar(1),
    readMinutes: 12,
    likes: 348,
    publishedAt: "2026-05-10",
    category: "guide",
  },
  {
    id: "b-hn-2",
    destName: "Hà Nội",
    title: "7 quán cafe trứ danh Hà Nội bạn nhất định phải thử",
    excerpt:
      "Từ cafe trứng Giảng cổ điển đến The Note Cafe đầy giấy nhớ — 7 quán cafe huyền thoại của thủ đô.",
    coverImage: img("1604908176997-125f25cc6f3d"),
    authorName: "Trần Minh",
    authorAvatar: avatar(12),
    readMinutes: 8,
    likes: 215,
    publishedAt: "2026-05-15",
    category: "food",
  },
  {
    id: "b-hn-3",
    destName: "Hà Nội",
    title: "3 ngày Hà Nội cho người mới đi lần đầu",
    excerpt: "Lịch trình tiết kiệm + đầy đủ trải nghiệm. Phố cổ, Văn Miếu, Hồ Tây và ẩm thực đêm.",
    coverImage: img("1538485399081-7191377e8241"),
    authorName: "Phạm Khánh Linh",
    authorAvatar: avatar(5),
    readMinutes: 15,
    likes: 422,
    publishedAt: "2026-04-28",
    category: "guide",
  },

  // Đà Nẵng
  {
    id: "b-dn-1",
    destName: "Đà Nẵng",
    title: "Cẩm nang 5N4Đ Đà Nẵng — Hội An tự túc",
    excerpt:
      "Tổng chi phí dưới 5 triệu/người. Lịch trình, khách sạn, ăn uống và mẹo đi lại tiết kiệm nhất.",
    coverImage: img("1583417267826-aebc4d1542e1"),
    authorName: "Lê Quốc Hùng",
    authorAvatar: avatar(14),
    readMinutes: 18,
    likes: 612,
    publishedAt: "2026-05-22",
    category: "guide",
  },
  {
    id: "b-dn-2",
    destName: "Đà Nẵng",
    title: "Cầu Vàng Bà Nà Hills: tip chụp ảnh đẹp nhất",
    excerpt:
      "Đi giờ nào ít người, góc nào ăn ảnh, mặc gì để hợp tone. Pre-wedding cũng cực kỳ lung linh.",
    coverImage: img("1602002418082-a4443e081dd1"),
    authorName: "Nguyễn Thị Mai",
    authorAvatar: avatar(9),
    readMinutes: 6,
    likes: 287,
    publishedAt: "2026-05-08",
    category: "tips",
  },
  {
    id: "b-dn-3",
    destName: "Đà Nẵng",
    title: "Top 10 quán hải sản tươi rẻ ở Đà Nẵng",
    excerpt:
      "Bé Mặn, Mỹ Hạnh, Bà Thôi — list những quán hải sản ngon-rẻ-bổ mà người Đà Nẵng cũng phải gật đầu.",
    coverImage: img("1565967511849-76a60a516170"),
    authorName: "Đặng Bảo Duy",
    authorAvatar: avatar(11),
    readMinutes: 10,
    likes: 396,
    publishedAt: "2026-04-30",
    category: "food",
  },

  // Hội An
  {
    id: "b-ha-1",
    destName: "Hội An",
    title: "Đêm phố cổ Hội An: thả đèn hoa đăng và những điều thú vị",
    excerpt:
      "Phố cổ về đêm lung linh đèn lồng. Hướng dẫn thả đèn trên sông Hoài, các show diễn không thể bỏ qua.",
    coverImage: img("1559592413-7cec4d0cae2b"),
    authorName: "Võ Thị Thu Hoa",
    authorAvatar: avatar(20),
    readMinutes: 7,
    likes: 458,
    publishedAt: "2026-05-18",
    category: "guide",
  },
  {
    id: "b-ha-2",
    destName: "Hội An",
    title: "Cao lầu — món ăn 'chỉ có ở Hội An'",
    excerpt: "Câu chuyện về sợi mì cao lầu đặc biệt và 5 quán cao lầu chuẩn vị nhất phố cổ.",
    coverImage: img("1604908176997-125f25cc6f3d"),
    authorName: "Bùi Anh Tuấn",
    authorAvatar: avatar(15),
    readMinutes: 9,
    likes: 312,
    publishedAt: "2026-05-12",
    category: "food",
  },

  // Sa Pa
  {
    id: "b-sp-1",
    destName: "Sa Pa",
    title: "Sa Pa mùa lúa chín tháng 9 — kinh nghiệm trekking",
    excerpt:
      "Trekking Cát Cát, Tả Van, Lao Chải. Thuê porter ở đâu, giá bao nhiêu, kèm checklist đồ đạc.",
    coverImage: img("1528127269322-539801943592"),
    authorName: "Đỗ Thuỳ Trang",
    authorAvatar: avatar(10),
    readMinutes: 14,
    likes: 534,
    publishedAt: "2026-05-25",
    category: "guide",
  },
  {
    id: "b-sp-2",
    destName: "Sa Pa",
    title: "Chinh phục Fansipan: cáp treo hay trekking?",
    excerpt:
      "So sánh trải nghiệm 2 cách lên đỉnh Đông Dương. Chi phí, thời gian, độ khó và khi nào nên chọn cái nào.",
    coverImage: img("1542359649-31e03cd4d909"),
    authorName: "Phan Hoài Nam",
    authorAvatar: avatar(13),
    readMinutes: 11,
    likes: 401,
    publishedAt: "2026-05-05",
    category: "tips",
  },

  // Đà Lạt
  {
    id: "b-dl-1",
    destName: "Đà Lạt",
    title: "Đà Lạt cho cặp đôi: 5 góc check-in lãng mạn nhất",
    excerpt:
      "Cánh đồng hoa cẩm tú cầu, đồi chè Cầu Đất, Linh Quy Pháp Ấn — đi tự túc bằng xe máy thuê.",
    coverImage: img("1528181304800-259b08848526"),
    authorName: "Nguyễn Thị Mai",
    authorAvatar: avatar(9),
    readMinutes: 9,
    likes: 678,
    publishedAt: "2026-05-20",
    category: "guide",
  },
  {
    id: "b-dl-2",
    destName: "Đà Lạt",
    title: "Ăn gì ở Đà Lạt: tổng hợp 15 món signature",
    excerpt:
      "Bánh tráng nướng, lẩu gà lá é, sữa đậu nành nóng hổi và những món Đà Lạt khi trời se lạnh.",
    coverImage: img("1504609813442-a8924e83f76e"),
    authorName: "Bùi Anh Tuấn",
    authorAvatar: avatar(15),
    readMinutes: 13,
    likes: 489,
    publishedAt: "2026-04-18",
    category: "food",
  },

  // Phú Quốc
  {
    id: "b-pq-1",
    destName: "Phú Quốc",
    title: "Phú Quốc 4N3Đ all-in dưới 6 triệu",
    excerpt:
      "Combo vé máy bay + khách sạn + tour Hòn Thơm, Bãi Sao. Lịch trình tối ưu cho gia đình và cặp đôi.",
    coverImage: img("1583417267826-aebc4d1542e1"),
    authorName: "Lê Quốc Hùng",
    authorAvatar: avatar(14),
    readMinutes: 16,
    likes: 567,
    publishedAt: "2026-05-28",
    category: "guide",
  },

  // Hạ Long
  {
    id: "b-hl-1",
    destName: "Hạ Long",
    title: "Du thuyền qua đêm vịnh Hạ Long: chọn hãng nào?",
    excerpt:
      "So sánh Paradise, Heritage, Indochina Sails — giá, trải nghiệm thực tế và mẹo đặt phòng giảm giá.",
    coverImage: img("1540541338287-41700207dee6"),
    authorName: "Trần Minh",
    authorAvatar: avatar(12),
    readMinutes: 12,
    likes: 392,
    publishedAt: "2026-05-14",
    category: "tips",
  },
];

// ──────────────────────────────────────────────────────────────
// TRIP TEMPLATES (clone-able itineraries from popular users)
// ──────────────────────────────────────────────────────────────

export const MOCK_TRIP_TEMPLATES: TripTemplate[] = [
  // Hà Nội
  {
    id: "t-hn-1",
    destName: "Hà Nội",
    title: "Hà Nội 3 ngày 2 đêm cho người mới",
    description: "Lịch trình kinh điển: phố cổ → Văn Miếu → Hồ Tây + ẩm thực đêm",
    coverImage: img("1559592413-7cec4d0cae2b"),
    numDays: 3,
    numPeople: 2,
    budgetVnd: 4500000,
    rating: 4.8,
    usedByCount: 234,
    tags: ["lần đầu", "cặp đôi", "ẩm thực"],
  },
  {
    id: "t-hn-2",
    destName: "Hà Nội",
    title: "Hà Nội & vùng phụ cận 5 ngày",
    description: "Kết hợp Hà Nội + Ninh Bình + Hạ Long. Đầy đủ trải nghiệm miền Bắc",
    coverImage: img("1538485399081-7191377e8241"),
    numDays: 5,
    numPeople: 4,
    budgetVnd: 9500000,
    rating: 4.7,
    usedByCount: 168,
    tags: ["gia đình", "thiên nhiên", "lịch sử"],
  },

  // Đà Nẵng
  {
    id: "t-dn-1",
    destName: "Đà Nẵng",
    title: "Đà Nẵng — Hội An 4N3Đ",
    description: "Bãi Mỹ Khê + Bà Nà + phố cổ Hội An. Cân bằng nghỉ dưỡng & khám phá",
    coverImage: img("1583417267826-aebc4d1542e1"),
    numDays: 4,
    numPeople: 4,
    budgetVnd: 6800000,
    rating: 4.9,
    usedByCount: 412,
    tags: ["biển", "gia đình", "phổ biến nhất"],
  },
  {
    id: "t-dn-2",
    destName: "Đà Nẵng",
    title: "Phượt Đà Nẵng tự túc 3N2Đ",
    description: "Xe máy thuê, ăn quán địa phương, ngủ homestay. Dưới 2.5tr/người",
    coverImage: img("1602002418082-a4443e081dd1"),
    numDays: 3,
    numPeople: 2,
    budgetVnd: 5000000,
    rating: 4.6,
    usedByCount: 287,
    tags: ["tiết kiệm", "phượt", "trẻ"],
  },

  // Hội An
  {
    id: "t-ha-1",
    destName: "Hội An",
    title: "Hội An chill cuối tuần",
    description: "Phố cổ + bãi An Bàng + làng gốm Thanh Hà. Chậm rãi tận hưởng",
    coverImage: img("1559592413-7cec4d0cae2b"),
    numDays: 2,
    numPeople: 2,
    budgetVnd: 3200000,
    rating: 4.8,
    usedByCount: 196,
    tags: ["cuối tuần", "cặp đôi", "thư giãn"],
  },

  // Sa Pa
  {
    id: "t-sp-1",
    destName: "Sa Pa",
    title: "Sa Pa trekking 3N2Đ mùa lúa chín",
    description: "Cát Cát + Tả Van + Lao Chải. Có guide địa phương, ngủ homestay người Mông",
    coverImage: img("1528127269322-539801943592"),
    numDays: 3,
    numPeople: 4,
    budgetVnd: 5500000,
    rating: 4.7,
    usedByCount: 145,
    tags: ["trekking", "văn hóa", "ảnh đẹp"],
  },

  // Đà Lạt
  {
    id: "t-dl-1",
    destName: "Đà Lạt",
    title: "Đà Lạt cặp đôi 3N2Đ",
    description: "Linh Quy Pháp Ấn + cánh đồng hoa + cafe đẹp. Lãng mạn chuẩn film",
    coverImage: img("1528181304800-259b08848526"),
    numDays: 3,
    numPeople: 2,
    budgetVnd: 4200000,
    rating: 4.9,
    usedByCount: 523,
    tags: ["cặp đôi", "lãng mạn", "cafe"],
  },

  // Phú Quốc
  {
    id: "t-pq-1",
    destName: "Phú Quốc",
    title: "Phú Quốc 4N3Đ all-in",
    description: "Bãi Sao + Hòn Thơm cáp treo + Vinpearl Safari. Phù hợp gia đình",
    coverImage: img("1583417267826-aebc4d1542e1"),
    numDays: 4,
    numPeople: 4,
    budgetVnd: 12500000,
    rating: 4.8,
    usedByCount: 308,
    tags: ["biển", "gia đình", "nghỉ dưỡng"],
  },

  // Hạ Long
  {
    id: "t-hl-1",
    destName: "Hạ Long",
    title: "Du thuyền Hạ Long 2N1Đ",
    description: "Cruise 5⭐ + chèo kayak + ăn hải sản trên vịnh. Pet-friendly",
    coverImage: img("1540541338287-41700207dee6"),
    numDays: 2,
    numPeople: 2,
    budgetVnd: 7800000,
    rating: 4.9,
    usedByCount: 234,
    tags: ["cao cấp", "cruise", "biển"],
  },
];

// ──────────────────────────────────────────────────────────────
// Q&A THREADS
// ──────────────────────────────────────────────────────────────

export const MOCK_QA_THREADS: QAThread[] = [
  // Hà Nội
  {
    id: "q-hn-1",
    destName: "Hà Nội",
    question: "Đi Hà Nội mùa nào đẹp nhất?",
    preview: "Mình dự định đi cuối năm, không biết nên đi tháng 10 hay tháng 12 thì hợp hơn?",
    authorName: "Trần Minh",
    authorAvatar: avatar(12),
    answerCount: 14,
    upvotes: 28,
    isAnswered: true,
    createdAt: "2026-05-20",
  },
  {
    id: "q-hn-2",
    destName: "Hà Nội",
    question: "Khách sạn nào view Hồ Gươm giá tầm 1.5tr/đêm?",
    preview: "Mình cần phòng có view hồ, không quá đắt, sạch sẽ và gần phố cổ để tiện đi bộ.",
    authorName: "Phạm Khánh Linh",
    authorAvatar: avatar(5),
    answerCount: 8,
    upvotes: 15,
    isAnswered: true,
    createdAt: "2026-05-18",
  },
  {
    id: "q-hn-3",
    destName: "Hà Nội",
    question: "Có nên đi tàu hỏa Hà Nội — Sa Pa thay vì xe khách?",
    preview: "Nghe nói tàu chậm hơn nhưng êm hơn. Mọi người trải nghiệm thế nào?",
    authorName: "Đặng Bảo Duy",
    authorAvatar: avatar(11),
    answerCount: 22,
    upvotes: 41,
    isAnswered: true,
    createdAt: "2026-05-15",
  },

  // Đà Nẵng
  {
    id: "q-dn-1",
    destName: "Đà Nẵng",
    question: "Đà Nẵng tháng 10 có mưa nhiều không?",
    preview: "Mình book chuyến giữa tháng 10, sợ gặp bão hoặc mưa cả tuần thì hỏng chuyến.",
    authorName: "Nguyễn Thị Mai",
    authorAvatar: avatar(9),
    answerCount: 18,
    upvotes: 35,
    isAnswered: true,
    createdAt: "2026-05-22",
  },
  {
    id: "q-dn-2",
    destName: "Đà Nẵng",
    question: "Đi Bà Nà nên buổi sáng hay chiều?",
    preview: "Sợ buổi sáng đông quá còn buổi chiều có chương trình lễ hội ánh sáng đúng không?",
    authorName: "Võ Thị Thu Hoa",
    authorAvatar: avatar(20),
    answerCount: 11,
    upvotes: 19,
    isAnswered: true,
    createdAt: "2026-05-19",
  },
  {
    id: "q-dn-3",
    destName: "Đà Nẵng",
    question: "Có nên thuê xe máy chạy từ Đà Nẵng vào Hội An?",
    preview: "Cung đường 30km, mình chạy có an toàn không? Hay book Grab cho khỏe?",
    authorName: "Lê Quốc Hùng",
    authorAvatar: avatar(14),
    answerCount: 16,
    upvotes: 24,
    isAnswered: false,
    createdAt: "2026-05-25",
  },

  // Hội An
  {
    id: "q-ha-1",
    destName: "Hội An",
    question: "Hội An đêm rằm có gì đặc biệt?",
    preview: "Nghe nói đêm rằm phố cổ tắt đèn, chỉ còn đèn lồng. Có thật sự đẹp như mạng đồn?",
    authorName: "Bùi Anh Tuấn",
    authorAvatar: avatar(15),
    answerCount: 9,
    upvotes: 17,
    isAnswered: true,
    createdAt: "2026-05-12",
  },
  {
    id: "q-ha-2",
    destName: "Hội An",
    question: "May đo áo dài ở Hội An mất bao lâu?",
    preview: "Có quán nào giao trong 24h không? Mình chỉ có 2 ngày ở Hội An.",
    authorName: "Đỗ Thuỳ Trang",
    authorAvatar: avatar(10),
    answerCount: 12,
    upvotes: 21,
    isAnswered: true,
    createdAt: "2026-05-08",
  },

  // Sa Pa
  {
    id: "q-sp-1",
    destName: "Sa Pa",
    question: "Sa Pa tháng 12 lạnh tới mức nào?",
    preview: "Có khả năng có tuyết không? Mặc bao nhiêu lớp cho đủ ấm?",
    authorName: "Phan Hoài Nam",
    authorAvatar: avatar(13),
    answerCount: 25,
    upvotes: 47,
    isAnswered: true,
    createdAt: "2026-05-28",
  },
  {
    id: "q-sp-2",
    destName: "Sa Pa",
    question: "Trekking Cát Cát cần thuê guide không?",
    preview: "Đường dễ đi không, có biển chỉ dẫn rõ ràng không hay nên có guide cho an toàn?",
    authorName: "Trần Minh",
    authorAvatar: avatar(12),
    answerCount: 14,
    upvotes: 22,
    isAnswered: false,
    createdAt: "2026-05-21",
  },

  // Đà Lạt
  {
    id: "q-dl-1",
    destName: "Đà Lạt",
    question: "Cuối tuần Đà Lạt có quá đông không?",
    preview: "Mình muốn không khí yên tĩnh, đi T7-CN có ổn không hay nên đi giữa tuần?",
    authorName: "Nguyễn Thị Thắm",
    authorAvatar: avatar(1),
    answerCount: 17,
    upvotes: 31,
    isAnswered: true,
    createdAt: "2026-05-26",
  },
  {
    id: "q-dl-2",
    destName: "Đà Lạt",
    question: "Đi Đà Lạt bằng xe máy từ Sài Gòn được không?",
    preview:
      "Cung đường khoảng 300km, mình chưa có kinh nghiệm chạy đường dài. Có nguy hiểm không?",
    authorName: "Đỗ Thuỳ Trang",
    authorAvatar: avatar(10),
    answerCount: 19,
    upvotes: 26,
    isAnswered: false,
    createdAt: "2026-05-23",
  },

  // Phú Quốc
  {
    id: "q-pq-1",
    destName: "Phú Quốc",
    question: "Phú Quốc đi mùa nào ít mưa nhất?",
    preview: "Mình book vé tháng 8, nghe nói mùa mưa. Có nên đổi sang tháng khác không?",
    authorName: "Bùi Anh Tuấn",
    authorAvatar: avatar(15),
    answerCount: 13,
    upvotes: 24,
    isAnswered: true,
    createdAt: "2026-05-30",
  },

  // Hạ Long
  {
    id: "q-hl-1",
    destName: "Hạ Long",
    question: "Cruise Hạ Long có say sóng không?",
    preview: "Mình hơi nhạy với say sóng, nghe nói vịnh ít sóng nhưng vẫn lo. Có thuốc gì hỗ trợ?",
    authorName: "Phạm Khánh Linh",
    authorAvatar: avatar(5),
    answerCount: 8,
    upvotes: 14,
    isAnswered: true,
    createdAt: "2026-05-17",
  },
];

// ──────────────────────────────────────────────────────────────
// Lookup helpers
// ──────────────────────────────────────────────────────────────

export function getBlogPostsFor(destName: string, limit = 6): BlogPost[] {
  return MOCK_BLOG_POSTS.filter((p) => p.destName === destName).slice(0, limit);
}

export function getTemplatesFor(destName: string, limit = 5): TripTemplate[] {
  return MOCK_TRIP_TEMPLATES.filter((t) => t.destName === destName).slice(0, limit);
}

export function getQAsFor(destName: string, limit = 4): QAThread[] {
  return MOCK_QA_THREADS.filter((q) => q.destName === destName).slice(0, limit);
}

export function formatVndCompact(amount: number): string {
  if (amount >= 1_000_000) return `${(amount / 1_000_000).toFixed(1).replace(/\.0$/, "")}tr`;
  if (amount >= 1_000) return `${Math.round(amount / 1_000)}k`;
  return `${amount}`;
}
