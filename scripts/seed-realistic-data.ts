/**
 * Seed realistic Vietnamese travel data for PlanGo.
 * Run: npx tsx scripts/seed-realistic-data.ts
 *
 * Safe to re-run: uses ON CONFLICT-style upserts where unique constraints exist;
 * otherwise wipes and re-inserts.
 */

import "dotenv/config";
import { drizzle } from "drizzle-orm/node-postgres";
import { eq, inArray, sql } from "drizzle-orm";
import pg from "pg";
import bcrypt from "bcrypt";
import {
  users,
  destinations,
  destinationType,
  pois,
  poiType,
  preferences,
  poiPreferences,
  trips,
  tripMembers,
  tripPreferences,
  itineraryDay,
  itineraryItems,
  tripReviews,
  itemReviews,
  notifications,
  expenses,
  poiOpeningHours,
} from "../shared/schema";

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});
const db = drizzle(pool);

// ══════════════════════════════════════════════════════════════
// Helpers
// ══════════════════════════════════════════════════════════════

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function pickN<T>(arr: T[], n: number): T[] {
  const shuffled = [...arr].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, Math.min(n, arr.length));
}

function unsplash(query: string, w = 800): string {
  const seed = Math.floor(Math.random() * 1000);
  return `https://images.unsplash.com/photo-${query}?w=${w}&q=80&auto=format&fit=crop&seed=${seed}`;
}

// ══════════════════════════════════════════════════════════════
// DATA: 15 destinations Việt Nam phổ biến
// ══════════════════════════════════════════════════════════════

const DESTINATIONS_DATA = [
  {
    name: "Hà Nội",
    typeName: "Thành phố",
    description:
      "Thủ đô ngàn năm văn hiến của Việt Nam với phố cổ 36 phố phường, Hồ Gươm thơ mộng, Văn Miếu cổ kính. Ẩm thực phong phú từ phở bò trứ danh đến bún chả, chả cá Lã Vọng.",
    address: "Hà Nội, Việt Nam",
    latitude: "21.02850000",
    longitude: "105.85420000",
    images: [
      "https://images.unsplash.com/photo-1573160103600-a3c5b3f60c5c?w=800",
      "https://images.unsplash.com/photo-1583417319070-4a69db38a482?w=800",
      "https://images.unsplash.com/photo-1559592413-7cec4d0cae2b?w=800",
    ],
    rating: "4.7",
  },
  {
    name: "TP. Hồ Chí Minh",
    typeName: "Thành phố",
    description:
      "Trung tâm kinh tế lớn nhất Việt Nam với nhịp sống sôi động 24/7. Hòa quyện giữa kiến trúc Pháp cổ điển (Nhà thờ Đức Bà, Bưu điện trung tâm) và hiện đại (Landmark 81). Đặc sản: cơm tấm, bánh mì, hủ tiếu.",
    address: "TP. Hồ Chí Minh, Việt Nam",
    latitude: "10.82310000",
    longitude: "106.62960000",
    images: [
      "https://images.unsplash.com/photo-1583417319070-4a69db38a482?w=800",
      "https://images.unsplash.com/photo-1602002418082-a4443e081dd1?w=800",
    ],
    rating: "4.6",
  },
  {
    name: "Đà Nẵng",
    typeName: "Biển đảo",
    description:
      "Thành phố đáng sống nhất Việt Nam với bãi biển Mỹ Khê đẹp top thế giới, Cầu Vàng nổi tiếng, Bà Nà Hills lãng mạn. Người dân thân thiện, ẩm thực mì Quảng, bánh xèo nức tiếng.",
    address: "Đà Nẵng, Việt Nam",
    latitude: "16.04710000",
    longitude: "108.20680000",
    images: [
      "https://images.unsplash.com/photo-1583417267826-aebc4d1542e1?w=800",
      "https://images.unsplash.com/photo-1573160103600-a3c5b3f60c5c?w=800",
      "https://images.unsplash.com/photo-1559592413-7cec4d0cae2b?w=800",
    ],
    rating: "4.8",
  },
  {
    name: "Hội An",
    typeName: "Di tích",
    description:
      "Phố cổ Hội An — Di sản Văn hóa Thế giới UNESCO. Đêm phố cổ rực rỡ đèn lồng, sông Hoài thơ mộng, nhà cổ Tấn Ký, chùa Cầu Nhật Bản. Cao lầu, mì Quảng, bánh mì Phượng là must-try.",
    address: "Hội An, Quảng Nam, Việt Nam",
    latitude: "15.88010000",
    longitude: "108.33800000",
    images: [
      "https://images.unsplash.com/photo-1559592413-7cec4d0cae2b?w=800",
      "https://images.unsplash.com/photo-1583417267826-aebc4d1542e1?w=800",
    ],
    rating: "4.9",
  },
  {
    name: "Sa Pa",
    typeName: "Núi non",
    description:
      "Thị xã vùng cao Tây Bắc với ruộng bậc thang kỳ vĩ, đỉnh Fansipan 'nóc nhà Đông Dương'. Bản làng dân tộc Mông, Dao, Tày đầy bản sắc. Khí hậu ôn đới mát mẻ quanh năm.",
    address: "Sa Pa, Lào Cai, Việt Nam",
    latitude: "22.33640000",
    longitude: "103.84380000",
    images: [
      "https://images.unsplash.com/photo-1528127269322-539801943592?w=800",
      "https://images.unsplash.com/photo-1542359649-31e03cd4d909?w=800",
    ],
    rating: "4.7",
  },
  {
    name: "Đà Lạt",
    typeName: "Nghỉ dưỡng",
    description:
      "Thành phố ngàn hoa với khí hậu se lạnh quanh năm. Hồ Xuân Hương lãng mạn, vườn hoa thành phố, nhà thờ Domaine de Marie. Đặc sản: bánh tráng nướng, lẩu gà lá é, dâu tây.",
    address: "Đà Lạt, Lâm Đồng, Việt Nam",
    latitude: "11.94040000",
    longitude: "108.45830000",
    images: [
      "https://images.unsplash.com/photo-1528127269322-539801943592?w=800",
      "https://images.unsplash.com/photo-1542359649-31e03cd4d909?w=800",
    ],
    rating: "4.6",
  },
  {
    name: "Phú Quốc",
    typeName: "Biển đảo",
    description:
      "Đảo Ngọc lớn nhất Việt Nam với bãi Sao cát trắng mịn, bãi Khem hoang sơ, làng chài Hàm Ninh. Lặn ngắm san hô ở An Thới, ăn nhum biển, ghẹ Hàm Ninh, ngắm hoàng hôn trên cầu Hôn.",
    address: "Phú Quốc, Kiên Giang, Việt Nam",
    latitude: "10.22700000",
    longitude: "103.96770000",
    images: [
      "https://images.unsplash.com/photo-1559592413-7cec4d0cae2b?w=800",
      "https://images.unsplash.com/photo-1583417267826-aebc4d1542e1?w=800",
    ],
    rating: "4.8",
  },
  {
    name: "Nha Trang",
    typeName: "Biển đảo",
    description:
      "Thành phố biển sôi động với bãi biển dài 7km, tháp Bà Ponagar cổ kính, đảo Khỉ. Bùn khoáng Tháp Bà, hải sản tươi sống, bún cá Sứa nổi tiếng. Vinpearl Land cho gia đình.",
    address: "Nha Trang, Khánh Hòa, Việt Nam",
    latitude: "12.23880000",
    longitude: "109.19670000",
    images: ["https://images.unsplash.com/photo-1583417267826-aebc4d1542e1?w=800"],
    rating: "4.5",
  },
  {
    name: "Hạ Long",
    typeName: "Biển đảo",
    description:
      "Di sản Thế giới UNESCO với 1.969 đảo đá vôi kỳ vĩ. Du thuyền qua đêm trên vịnh, chèo kayak vào hang Sửng Sốt, hang Trinh Nữ. Chả mực, bún bề bề là đặc sản phải thử.",
    address: "Hạ Long, Quảng Ninh, Việt Nam",
    latitude: "20.96010000",
    longitude: "107.04610000",
    images: [
      "https://images.unsplash.com/photo-1528127269322-539801943592?w=800",
      "https://images.unsplash.com/photo-1583417267826-aebc4d1542e1?w=800",
    ],
    rating: "4.8",
  },
  {
    name: "Huế",
    typeName: "Di tích",
    description:
      "Cố đô triều Nguyễn với Đại Nội nguy nga, lăng Khải Định, chùa Thiên Mụ bên sông Hương. Ẩm thực cung đình tinh tế: bún bò Huế, cơm hến, chè cung đình.",
    address: "Huế, Thừa Thiên Huế, Việt Nam",
    latitude: "16.46370000",
    longitude: "107.59080000",
    images: ["https://images.unsplash.com/photo-1559592413-7cec4d0cae2b?w=800"],
    rating: "4.7",
  },
  {
    name: "Ninh Bình",
    typeName: "Núi non",
    description:
      "'Hạ Long trên cạn' với Tam Cốc - Bích Động, Tràng An (Di sản UNESCO), chùa Bái Đính. Ngắm cố đô Hoa Lư, thả hồn trên thuyền tre qua hang động kỳ vĩ.",
    address: "Ninh Bình, Việt Nam",
    latitude: "20.25060000",
    longitude: "105.97450000",
    images: ["https://images.unsplash.com/photo-1528127269322-539801943592?w=800"],
    rating: "4.7",
  },
  {
    name: "Mộc Châu",
    typeName: "Núi non",
    description:
      "Cao nguyên Mộc Châu rực rỡ hoa cải trắng tháng 11, hoa mận hoa mơ tháng 1-2. Đồi chè trái tim, thác Dải Yếm, hang Dơi. Sữa Mộc Châu, mận hậu, dâu tây organic.",
    address: "Mộc Châu, Sơn La, Việt Nam",
    latitude: "20.82770000",
    longitude: "104.66110000",
    images: ["https://images.unsplash.com/photo-1528127269322-539801943592?w=800"],
    rating: "4.6",
  },
  {
    name: "Cần Thơ",
    typeName: "Nông thôn",
    description:
      "Thủ phủ miền Tây sông nước với chợ nổi Cái Răng nhộn nhịp lúc bình minh, miệt vườn trái cây, nhà cổ Bình Thủy. Lẩu mắm, bánh xèo, bún cá là đặc sản nhất định phải nếm.",
    address: "Cần Thơ, Việt Nam",
    latitude: "10.04520000",
    longitude: "105.74690000",
    images: ["https://images.unsplash.com/photo-1559592413-7cec4d0cae2b?w=800"],
    rating: "4.5",
  },
  {
    name: "Phong Nha - Kẻ Bàng",
    typeName: "Núi non",
    description:
      "Di sản Thiên nhiên UNESCO với hệ thống hang động kỳ vĩ. Hang Sơn Đoòng — hang lớn nhất thế giới, hang Én, động Phong Nha, động Tiên Sơn. Trekking, kayak, ngắm thiên nhiên hoang sơ.",
    address: "Phong Nha, Quảng Bình, Việt Nam",
    latitude: "17.51790000",
    longitude: "106.28840000",
    images: ["https://images.unsplash.com/photo-1528127269322-539801943592?w=800"],
    rating: "4.8",
  },
  {
    name: "Vũng Tàu",
    typeName: "Biển đảo",
    description:
      "Thành phố biển gần Sài Gòn — chỉ 2 tiếng lái xe. Bãi Sau dài rộng, tượng Chúa Kitô Vua trên núi Nhỏ, hải đăng Vũng Tàu. Bánh khọt, lẩu cá đuối, hải sản tươi giá tốt.",
    address: "Vũng Tàu, Bà Rịa - Vũng Tàu, Việt Nam",
    latitude: "10.34600000",
    longitude: "107.08430000",
    images: ["https://images.unsplash.com/photo-1559592413-7cec4d0cae2b?w=800"],
    rating: "4.4",
  },
];

// POI data per destination — kết hợp attractions, restaurants, hotels, cafes
const POIS_BY_DEST: Record<
  string,
  {
    name: string;
    type: string;
    address: string;
    latOffset: number;
    lngOffset: number;
    description: string;
    estimatedCost: number;
    rating: number;
    prefs?: string[];
  }[]
> = {
  "Hà Nội": [
    {
      name: "Hồ Gươm",
      type: "attraction",
      address: "Hoàn Kiếm, Hà Nội",
      latOffset: 0.001,
      lngOffset: 0.001,
      description: "Hồ thiêng giữa thủ đô với cầu Thê Húc đỏ rực và đền Ngọc Sơn",
      estimatedCost: 0,
      rating: 4.7,
      prefs: ["Văn hóa", "Lịch sử"],
    },
    {
      name: "Văn Miếu - Quốc Tử Giám",
      type: "attraction",
      address: "58 Quốc Tử Giám, Đống Đa, Hà Nội",
      latOffset: -0.005,
      lngOffset: -0.015,
      description: "Trường đại học đầu tiên của Việt Nam, di tích văn hóa lịch sử nghìn năm",
      estimatedCost: 30000,
      rating: 4.6,
      prefs: ["Lịch sử", "Văn hóa"],
    },
    {
      name: "Phố cổ 36 phố phường",
      type: "attraction",
      address: "Hoàn Kiếm, Hà Nội",
      latOffset: 0.002,
      lngOffset: 0.002,
      description: "Khu phố cổ với kiến trúc Pháp - Việt cổ kính, ẩm thực đường phố phong phú",
      estimatedCost: 0,
      rating: 4.7,
      prefs: ["Văn hóa", "Ẩm thực"],
    },
    {
      name: "Phở Thìn Lò Đúc",
      type: "restaurant",
      address: "13 Lò Đúc, Hai Bà Trưng, Hà Nội",
      latOffset: 0.003,
      lngOffset: 0.008,
      description: "Phở bò tái lăn trứ danh, nước dùng đậm đà, được Anthony Bourdain khen ngợi",
      estimatedCost: 75000,
      rating: 4.5,
      prefs: ["Ẩm thực"],
    },
    {
      name: "Bún Chả Hương Liên",
      type: "restaurant",
      address: "24 Lê Văn Hưu, Hai Bà Trưng, Hà Nội",
      latOffset: 0.004,
      lngOffset: 0.006,
      description: "Quán bún chả Obama từng ghé. Bún chả đậm chất Hà Nội, thịt nướng vàng ươm",
      estimatedCost: 85000,
      rating: 4.4,
      prefs: ["Ẩm thực"],
    },
    {
      name: "The Cafe Apartment",
      type: "cafe",
      address: "42 Nguyễn Huệ, Quận 1, TP.HCM",
      latOffset: 0.008,
      lngOffset: -0.002,
      description: "Tổ hợp cafe trong tòa nhà cổ độc đáo, mỗi tầng một phong cách",
      estimatedCost: 60000,
      rating: 4.5,
      prefs: ["Văn hóa", "Nhiếp ảnh"],
    },
    {
      name: "Sofitel Legend Metropole",
      type: "hotel",
      address: "15 Ngô Quyền, Hoàn Kiếm, Hà Nội",
      latOffset: 0.001,
      lngOffset: 0.003,
      description: "Khách sạn 5 sao lịch sử từ 1901, biểu tượng sang trọng của Hà Nội",
      estimatedCost: 4500000,
      rating: 4.9,
      prefs: ["Nghỉ dưỡng", "Lịch sử"],
    },
    {
      name: "Lăng Bác",
      type: "attraction",
      address: "2 Hùng Vương, Ba Đình, Hà Nội",
      latOffset: -0.012,
      lngOffset: -0.02,
      description: "Lăng Chủ tịch Hồ Chí Minh — di tích lịch sử quốc gia thiêng liêng",
      estimatedCost: 0,
      rating: 4.6,
      prefs: ["Lịch sử"],
    },
  ],
  "TP. Hồ Chí Minh": [
    {
      name: "Nhà thờ Đức Bà Sài Gòn",
      type: "attraction",
      address: "1 Công xã Paris, Quận 1, TP.HCM",
      latOffset: 0.001,
      lngOffset: 0.001,
      description: "Nhà thờ Công giáo kiến trúc Pháp tuyệt đẹp, biểu tượng Sài Gòn",
      estimatedCost: 0,
      rating: 4.7,
      prefs: ["Văn hóa", "Lịch sử"],
    },
    {
      name: "Bưu điện Trung tâm Sài Gòn",
      type: "attraction",
      address: "2 Công xã Paris, Quận 1, TP.HCM",
      latOffset: 0.001,
      lngOffset: 0.001,
      description: "Tòa nhà cổ kiến trúc Pháp do Gustave Eiffel thiết kế, vẫn hoạt động đến nay",
      estimatedCost: 0,
      rating: 4.6,
      prefs: ["Văn hóa", "Lịch sử"],
    },
    {
      name: "Landmark 81",
      type: "attraction",
      address: "720A Điện Biên Phủ, Bình Thạnh, TP.HCM",
      latOffset: 0.008,
      lngOffset: 0.005,
      description: "Tòa nhà cao nhất Việt Nam — Sky Bar tầng 81 ngắm toàn cảnh Sài Gòn",
      estimatedCost: 300000,
      rating: 4.7,
      prefs: ["Thành phố", "Nhiếp ảnh"],
    },
    {
      name: "Chợ Bến Thành",
      type: "shopping",
      address: "Lê Lợi, Bến Thành, Quận 1, TP.HCM",
      latOffset: 0.002,
      lngOffset: 0.001,
      description: "Chợ biểu tượng Sài Gòn với đủ mặt hàng từ ẩm thực đến đồ thủ công mỹ nghệ",
      estimatedCost: 50000,
      rating: 4.3,
      prefs: ["Mua sắm", "Ẩm thực"],
    },
    {
      name: "Cơm Tấm Ba Ghiền",
      type: "restaurant",
      address: "84 Đặng Văn Ngữ, Phú Nhuận, TP.HCM",
      latOffset: 0.012,
      lngOffset: -0.008,
      description: "Cơm tấm sườn nướng trứ danh, miếng sườn to ngon, được Michelin Guide khen",
      estimatedCost: 95000,
      rating: 4.6,
      prefs: ["Ẩm thực"],
    },
    {
      name: "Bánh Mì Huỳnh Hoa",
      type: "restaurant",
      address: "26 Lê Thị Riêng, Quận 1, TP.HCM",
      latOffset: 0.005,
      lngOffset: 0.002,
      description: "Bánh mì Sài Gòn ngon nhất với pate béo ngậy, thịt nguội đầy đặn",
      estimatedCost: 55000,
      rating: 4.7,
      prefs: ["Ẩm thực"],
    },
    {
      name: "The Coffee House Signature",
      type: "cafe",
      address: "27 Nguyễn Trung Trực, Quận 1, TP.HCM",
      latOffset: 0.003,
      lngOffset: 0.002,
      description: "Quán cafe view đẹp, không gian rộng, decor tinh tế. Cafe Việt + đồ Tây",
      estimatedCost: 65000,
      rating: 4.4,
      prefs: ["Văn hóa"],
    },
    {
      name: "Park Hyatt Saigon",
      type: "hotel",
      address: "2 Công trường Lam Sơn, Quận 1, TP.HCM",
      latOffset: 0.001,
      lngOffset: 0.002,
      description: "Khách sạn 5 sao trung tâm Sài Gòn, dịch vụ đẳng cấp quốc tế",
      estimatedCost: 5500000,
      rating: 4.8,
      prefs: ["Nghỉ dưỡng"],
    },
  ],
  "Đà Nẵng": [
    {
      name: "Cầu Vàng - Bà Nà Hills",
      type: "attraction",
      address: "An Sơn, Hòa Vang, Đà Nẵng",
      latOffset: -0.18,
      lngOffset: -0.12,
      description:
        "Cây cầu vàng nổi tiếng thế giới với đôi tay khổng lồ nâng đỡ, nằm trên đỉnh Bà Nà",
      estimatedCost: 850000,
      rating: 4.8,
      prefs: ["Nhiếp ảnh", "Núi"],
    },
    {
      name: "Bãi biển Mỹ Khê",
      type: "attraction",
      address: "Võ Nguyên Giáp, Sơn Trà, Đà Nẵng",
      latOffset: 0.015,
      lngOffset: 0.012,
      description: "Bãi biển đẹp nhất Việt Nam theo Forbes, cát trắng mịn, sóng êm",
      estimatedCost: 0,
      rating: 4.7,
      prefs: ["Biển"],
    },
    {
      name: "Cầu Rồng",
      type: "attraction",
      address: "Bạch Đằng, Hải Châu, Đà Nẵng",
      latOffset: 0.001,
      lngOffset: 0.005,
      description:
        "Cầu hình rồng phun lửa và nước tối thứ 7 và CN 21h. Biểu tượng Đà Nẵng hiện đại",
      estimatedCost: 0,
      rating: 4.6,
      prefs: ["Nhiếp ảnh", "Văn hóa"],
    },
    {
      name: "Bán đảo Sơn Trà",
      type: "attraction",
      address: "Sơn Trà, Đà Nẵng",
      latOffset: 0.025,
      lngOffset: 0.045,
      description:
        "Khu bảo tồn thiên nhiên với chùa Linh Ứng, tượng Phật Bà cao 67m, vọng cảnh toàn thành phố",
      estimatedCost: 0,
      rating: 4.7,
      prefs: ["Văn hóa", "Thiên nhiên"],
    },
    {
      name: "Mì Quảng Bà Mua",
      type: "restaurant",
      address: "19-21 Trần Bình Trọng, Hải Châu, Đà Nẵng",
      latOffset: 0.003,
      lngOffset: 0.001,
      description: "Mì Quảng chuẩn vị truyền thống, nước dùng đậm đà, tôm thịt tươi ngon",
      estimatedCost: 50000,
      rating: 4.5,
      prefs: ["Ẩm thực"],
    },
    {
      name: "Bánh Xèo Bà Dưỡng",
      type: "restaurant",
      address: "K280/23 Hoàng Diệu, Hải Châu, Đà Nẵng",
      latOffset: 0.002,
      lngOffset: -0.003,
      description: "Bánh xèo giòn rụm với tôm thịt đầy đặn, ăn với rau sống và nước chấm đặc biệt",
      estimatedCost: 60000,
      rating: 4.4,
      prefs: ["Ẩm thực"],
    },
    {
      name: "InterContinental Danang Sun Peninsula",
      type: "hotel",
      address: "Bãi Bắc, Sơn Trà, Đà Nẵng",
      latOffset: 0.035,
      lngOffset: 0.04,
      description:
        "Resort 5 sao trên bán đảo Sơn Trà, view biển tuyệt đẹp, được Conde Nast vinh danh",
      estimatedCost: 12000000,
      rating: 4.9,
      prefs: ["Nghỉ dưỡng", "Biển"],
    },
    {
      name: "Cocobay Đà Nẵng",
      type: "hotel",
      address: "Trường Sa, Ngũ Hành Sơn, Đà Nẵng",
      latOffset: -0.012,
      lngOffset: 0.008,
      description: "Khu nghỉ dưỡng gần biển với phong cách Địa Trung Hải, giá hợp lý",
      estimatedCost: 1500000,
      rating: 4.3,
      prefs: ["Nghỉ dưỡng"],
    },
  ],
  "Hội An": [
    {
      name: "Phố cổ Hội An",
      type: "attraction",
      address: "Phố cổ, Hội An, Quảng Nam",
      latOffset: 0.001,
      lngOffset: 0.001,
      description: "Khu phố cổ UNESCO với những ngôi nhà cổ vàng rực, đèn lồng đầy màu sắc về đêm",
      estimatedCost: 120000,
      rating: 4.9,
      prefs: ["Văn hóa", "Lịch sử", "Nhiếp ảnh"],
    },
    {
      name: "Chùa Cầu Nhật Bản",
      type: "attraction",
      address: "Trần Phú, Hội An",
      latOffset: 0.001,
      lngOffset: 0.002,
      description: "Cây cầu mái che Nhật Bản 400 năm tuổi, biểu tượng Hội An",
      estimatedCost: 80000,
      rating: 4.7,
      prefs: ["Lịch sử", "Văn hóa"],
    },
    {
      name: "Bãi biển An Bàng",
      type: "attraction",
      address: "An Bàng, Hội An",
      latOffset: 0.02,
      lngOffset: 0.015,
      description: "Bãi biển hoang sơ yên tĩnh, ít người, nước trong xanh, hoàng hôn tuyệt đẹp",
      estimatedCost: 0,
      rating: 4.6,
      prefs: ["Biển", "Nghỉ dưỡng"],
    },
    {
      name: "Cao lầu Thanh",
      type: "restaurant",
      address: "26 Thái Phiên, Hội An",
      latOffset: 0.001,
      lngOffset: 0.002,
      description: "Quán cao lầu truyền thống — món đặc sản chỉ có ở Hội An. Sợi mì độc đáo",
      estimatedCost: 50000,
      rating: 4.6,
      prefs: ["Ẩm thực"],
    },
    {
      name: "Bánh Mì Phượng",
      type: "restaurant",
      address: "2B Phan Châu Trinh, Hội An",
      latOffset: 0.001,
      lngOffset: 0.002,
      description: "Bánh mì nổi tiếng nhất Việt Nam, Anthony Bourdain từng ca ngợi",
      estimatedCost: 40000,
      rating: 4.8,
      prefs: ["Ẩm thực"],
    },
    {
      name: "Reaching Out Tea House",
      type: "cafe",
      address: "131 Trần Phú, Hội An",
      latOffset: 0.001,
      lngOffset: 0.002,
      description: "Quán trà yên tĩnh do người khiếm thính phục vụ — trải nghiệm độc đáo",
      estimatedCost: 75000,
      rating: 4.7,
      prefs: ["Văn hóa"],
    },
    {
      name: "Anantara Hoi An Resort",
      type: "hotel",
      address: "1 Phạm Hồng Thái, Hội An",
      latOffset: 0.003,
      lngOffset: 0.005,
      description: "Resort 5 sao bên sông Thu Bồn, kiến trúc kết hợp truyền thống Việt và hiện đại",
      estimatedCost: 5500000,
      rating: 4.8,
      prefs: ["Nghỉ dưỡng"],
    },
  ],
  "Sa Pa": [
    {
      name: "Đỉnh Fansipan",
      type: "attraction",
      address: "Hoàng Liên, Sa Pa",
      latOffset: -0.02,
      lngOffset: -0.025,
      description: "Nóc nhà Đông Dương 3.143m, đi cáp treo lên đỉnh ngắm biển mây kỳ vĩ",
      estimatedCost: 800000,
      rating: 4.7,
      prefs: ["Núi", "Phiêu lưu", "Nhiếp ảnh"],
    },
    {
      name: "Bản Cát Cát",
      type: "attraction",
      address: "Cát Cát, Sa Pa",
      latOffset: -0.015,
      lngOffset: -0.012,
      description: "Bản người Mông cổ với ruộng bậc thang đẹp mê hồn, thác nước thơ mộng",
      estimatedCost: 90000,
      rating: 4.6,
      prefs: ["Văn hóa", "Thiên nhiên"],
    },
    {
      name: "Bản Tả Van",
      type: "attraction",
      address: "Tả Van, Sa Pa",
      latOffset: -0.025,
      lngOffset: 0.005,
      description: "Bản người Dáy với ruộng bậc thang, trekking thư giãn qua các bản làng",
      estimatedCost: 50000,
      rating: 4.5,
      prefs: ["Văn hóa", "Phiêu lưu"],
    },
    {
      name: "Thắng Cố Bản Khoang",
      type: "restaurant",
      address: "Sapa, Lào Cai",
      latOffset: 0.001,
      lngOffset: 0.002,
      description: "Đặc sản dân tộc Mông — thắng cố ngựa, lẩu cá hồi Sa Pa độc đáo",
      estimatedCost: 150000,
      rating: 4.3,
      prefs: ["Ẩm thực", "Văn hóa"],
    },
    {
      name: "The Hill Station Signature",
      type: "restaurant",
      address: "37 Fansipan, Sa Pa",
      latOffset: 0.001,
      lngOffset: -0.001,
      description: "Nhà hàng view đẹp với menu kết hợp Tây - Việt, không gian ấm cúng",
      estimatedCost: 350000,
      rating: 4.7,
      prefs: ["Ẩm thực", "Nghỉ dưỡng"],
    },
    {
      name: "Hôtel de la Coupole - MGallery",
      type: "hotel",
      address: "1 Hoàng Liên, Sa Pa",
      latOffset: 0.002,
      lngOffset: 0.001,
      description:
        "Khách sạn 5 sao thiết kế bởi Bill Bensley, kiến trúc lộng lẫy, dịch vụ đẳng cấp",
      estimatedCost: 4500000,
      rating: 4.8,
      prefs: ["Nghỉ dưỡng", "Núi"],
    },
  ],
  "Đà Lạt": [
    {
      name: "Hồ Xuân Hương",
      type: "attraction",
      address: "Trung tâm Đà Lạt",
      latOffset: 0.001,
      lngOffset: 0.001,
      description: "Hồ thơ mộng giữa lòng thành phố, đạp xe đôi quanh hồ rất lãng mạn",
      estimatedCost: 0,
      rating: 4.5,
      prefs: ["Văn hóa", "Nghỉ dưỡng"],
    },
    {
      name: "Quảng trường Lâm Viên",
      type: "attraction",
      address: "Trần Quốc Toản, Đà Lạt",
      latOffset: 0.002,
      lngOffset: -0.001,
      description: "Quảng trường biểu tượng với công trình hoa actiso khổng lồ, đêm rực sáng",
      estimatedCost: 0,
      rating: 4.4,
      prefs: ["Văn hóa"],
    },
    {
      name: "Vườn hoa thành phố",
      type: "attraction",
      address: "Phù Đổng Thiên Vương, Đà Lạt",
      latOffset: 0.005,
      lngOffset: 0.003,
      description: "Vườn hoa lớn nhất Đà Lạt với hàng trăm loài hoa rực rỡ quanh năm",
      estimatedCost: 50000,
      rating: 4.3,
      prefs: ["Nhiếp ảnh", "Thiên nhiên"],
    },
    {
      name: "Bánh Tráng Nướng Cô Hoa",
      type: "restaurant",
      address: "30 Nguyễn Văn Trỗi, Đà Lạt",
      latOffset: 0.001,
      lngOffset: 0.001,
      description: "Quán bánh tráng nướng nổi tiếng nhất Đà Lạt — 'pizza Việt' giòn ngon",
      estimatedCost: 25000,
      rating: 4.5,
      prefs: ["Ẩm thực"],
    },
    {
      name: "Lẩu gà lá é Tao Ngộ",
      type: "restaurant",
      address: "53 Phan Đình Phùng, Đà Lạt",
      latOffset: 0.002,
      lngOffset: 0.001,
      description: "Lẩu gà lá é đặc sản, nước dùng thơm ngon, ấm áp khi trời lạnh",
      estimatedCost: 250000,
      rating: 4.6,
      prefs: ["Ẩm thực"],
    },
    {
      name: "An Cafe",
      type: "cafe",
      address: "63B Đào Duy Từ, Đà Lạt",
      latOffset: 0.001,
      lngOffset: -0.001,
      description: "Quán cafe gỗ ấm cúng, view thông xanh, đặc trưng phong cách Đà Lạt",
      estimatedCost: 55000,
      rating: 4.6,
      prefs: ["Văn hóa", "Nhiếp ảnh"],
    },
    {
      name: "Ana Mandara Villas Dalat Resort",
      type: "hotel",
      address: "Le Lai, Đà Lạt",
      latOffset: -0.008,
      lngOffset: 0.005,
      description: "Khu nghỉ dưỡng với 17 biệt thự Pháp cổ thập niên 1920, không gian lãng mạn",
      estimatedCost: 3500000,
      rating: 4.7,
      prefs: ["Nghỉ dưỡng"],
    },
  ],
  "Phú Quốc": [
    {
      name: "Bãi Sao",
      type: "attraction",
      address: "An Thới, Phú Quốc",
      latOffset: -0.08,
      lngOffset: 0.02,
      description:
        "Bãi biển đẹp nhất Phú Quốc — cát trắng mịn, nước trong xanh, hoàng hôn lãng mạn",
      estimatedCost: 0,
      rating: 4.7,
      prefs: ["Biển", "Nhiếp ảnh"],
    },
    {
      name: "Vinpearl Safari",
      type: "attraction",
      address: "Gành Dầu, Phú Quốc",
      latOffset: 0.06,
      lngOffset: -0.04,
      description: "Công viên động vật hoang dã bán hoang dã lớn nhất Việt Nam, gặp hổ trắng, voi",
      estimatedCost: 650000,
      rating: 4.6,
      prefs: ["Phiêu lưu", "Thiên nhiên"],
    },
    {
      name: "Cáp treo Hòn Thơm",
      type: "attraction",
      address: "An Thới, Phú Quốc",
      latOffset: -0.09,
      lngOffset: 0.015,
      description: "Cáp treo vượt biển dài nhất thế giới 7.9km, view ngoạn mục các đảo An Thới",
      estimatedCost: 700000,
      rating: 4.7,
      prefs: ["Biển", "Nhiếp ảnh"],
    },
    {
      name: "Chợ đêm Dinh Cậu",
      type: "shopping",
      address: "Bạch Đằng, Phú Quốc",
      latOffset: 0.002,
      lngOffset: 0.001,
      description: "Chợ đêm sôi động với hải sản tươi sống, quán nhậu, đồ lưu niệm",
      estimatedCost: 200000,
      rating: 4.3,
      prefs: ["Ẩm thực", "Giải trí đêm"],
    },
    {
      name: "Hải sản Crab House",
      type: "restaurant",
      address: "26 Nguyễn Trung Trực, Dương Đông, Phú Quốc",
      latOffset: 0.001,
      lngOffset: 0.002,
      description: "Nhà hàng hải sản nổi tiếng — ghẹ Hàm Ninh, tôm hùm, nhum biển tươi",
      estimatedCost: 800000,
      rating: 4.7,
      prefs: ["Ẩm thực", "Biển"],
    },
    {
      name: "JW Marriott Phú Quốc Emerald Bay",
      type: "hotel",
      address: "Bãi Khem, An Thới, Phú Quốc",
      latOffset: -0.075,
      lngOffset: 0.018,
      description: "Khu nghỉ dưỡng 5 sao Bill Bensley thiết kế lấy cảm hứng đại học cổ Pháp",
      estimatedCost: 8500000,
      rating: 4.9,
      prefs: ["Nghỉ dưỡng", "Biển"],
    },
  ],
  "Nha Trang": [
    {
      name: "Tháp Bà Ponagar",
      type: "attraction",
      address: "61 Hai Tháng Tư, Nha Trang",
      latOffset: 0.012,
      lngOffset: -0.005,
      description: "Quần thể tháp Chăm 1.000 năm tuổi, di tích văn hóa quan trọng",
      estimatedCost: 50000,
      rating: 4.5,
      prefs: ["Văn hóa", "Lịch sử"],
    },
    {
      name: "Vinpearl Land Nha Trang",
      type: "attraction",
      address: "Hòn Tre, Nha Trang",
      latOffset: -0.03,
      lngOffset: 0.025,
      description: "Công viên giải trí + thủy cung trên đảo Hòn Tre, đi cáp treo vượt biển",
      estimatedCost: 1200000,
      rating: 4.6,
      prefs: ["Phiêu lưu", "Biển"],
    },
    {
      name: "Bùn khoáng Tháp Bà",
      type: "attraction",
      address: "Tháp Bà, Nha Trang",
      latOffset: 0.013,
      lngOffset: -0.004,
      description: "Tắm bùn khoáng nóng tự nhiên — trải nghiệm spa độc đáo Nha Trang",
      estimatedCost: 250000,
      rating: 4.4,
      prefs: ["Nghỉ dưỡng"],
    },
    {
      name: "Bún cá Sứa Năm Beo",
      type: "restaurant",
      address: "29 Bạch Đằng, Nha Trang",
      latOffset: 0.001,
      lngOffset: 0.001,
      description: "Bún cá sứa Nha Trang chuẩn vị — nước dùng ngọt thanh, sứa giòn",
      estimatedCost: 45000,
      rating: 4.5,
      prefs: ["Ẩm thực"],
    },
    {
      name: "Sheraton Nha Trang Hotel & Spa",
      type: "hotel",
      address: "26-28 Trần Phú, Nha Trang",
      latOffset: 0.001,
      lngOffset: 0.001,
      description: "Khách sạn 5 sao trung tâm với hồ bơi vô cực view biển",
      estimatedCost: 4000000,
      rating: 4.7,
      prefs: ["Nghỉ dưỡng", "Biển"],
    },
  ],
  "Hạ Long": [
    {
      name: "Vịnh Hạ Long",
      type: "attraction",
      address: "Hạ Long, Quảng Ninh",
      latOffset: 0.005,
      lngOffset: 0.02,
      description: "Di sản Thế giới UNESCO — 1.969 hòn đảo đá vôi kỳ vĩ giữa biển Đông",
      estimatedCost: 290000,
      rating: 4.8,
      prefs: ["Biển", "Nhiếp ảnh"],
    },
    {
      name: "Du thuyền qua đêm trên vịnh",
      type: "attraction",
      address: "Cảng tàu Tuần Châu, Hạ Long",
      latOffset: -0.01,
      lngOffset: 0.015,
      description: "Trải nghiệm 1-2 đêm trên du thuyền 5 sao, ngắm hoàng hôn vịnh Hạ Long",
      estimatedCost: 4500000,
      rating: 4.9,
      prefs: ["Nghỉ dưỡng", "Biển"],
    },
    {
      name: "Hang Sửng Sốt",
      type: "attraction",
      address: "Đảo Bồ Hòn, Hạ Long",
      latOffset: 0.02,
      lngOffset: 0.04,
      description: "Hang động lớn nhất vịnh Hạ Long, nhũ đá độc đáo kỳ vĩ",
      estimatedCost: 80000,
      rating: 4.6,
      prefs: ["Phiêu lưu", "Thiên nhiên"],
    },
    {
      name: "Chả mực Bà Tỵ",
      type: "restaurant",
      address: "118 Lê Thánh Tông, Hạ Long",
      latOffset: 0.001,
      lngOffset: 0.002,
      description: "Chả mực đặc sản Hạ Long — giòn dai ngọt thơm, kèm bánh cuốn nóng",
      estimatedCost: 200000,
      rating: 4.5,
      prefs: ["Ẩm thực", "Biển"],
    },
    {
      name: "Vinpearl Resort Halong",
      type: "hotel",
      address: "Đảo Rều, Hạ Long",
      latOffset: -0.005,
      lngOffset: 0.01,
      description: "Resort 5 sao trên đảo riêng, view vịnh Hạ Long tuyệt đẹp",
      estimatedCost: 6500000,
      rating: 4.7,
      prefs: ["Nghỉ dưỡng", "Biển"],
    },
  ],
  Huế: [
    {
      name: "Đại Nội (Hoàng thành Huế)",
      type: "attraction",
      address: "Phú Hậu, TP Huế",
      latOffset: 0.005,
      lngOffset: -0.005,
      description: "Hoàng cung triều Nguyễn — Di sản UNESCO, kiến trúc cung đình lộng lẫy",
      estimatedCost: 200000,
      rating: 4.7,
      prefs: ["Lịch sử", "Văn hóa"],
    },
    {
      name: "Lăng Khải Định",
      type: "attraction",
      address: "Châu Chữ, Hương Thủy, Huế",
      latOffset: -0.04,
      lngOffset: 0.02,
      description: "Lăng tẩm độc đáo kết hợp Đông Tây, mosaic thủy tinh tinh xảo",
      estimatedCost: 150000,
      rating: 4.8,
      prefs: ["Lịch sử", "Văn hóa"],
    },
    {
      name: "Chùa Thiên Mụ",
      type: "attraction",
      address: "Kim Long, TP Huế",
      latOffset: 0.01,
      lngOffset: -0.025,
      description: "Ngôi chùa cổ kính bên sông Hương, tháp Phước Duyên 7 tầng biểu tượng",
      estimatedCost: 0,
      rating: 4.6,
      prefs: ["Văn hóa", "Lịch sử"],
    },
    {
      name: "Bún Bò Huế Bà Tuyết",
      type: "restaurant",
      address: "47 Nguyễn Công Trứ, Huế",
      latOffset: 0.001,
      lngOffset: 0.002,
      description: "Bún bò Huế chuẩn vị cung đình, nước dùng đậm đà cay nồng đặc trưng",
      estimatedCost: 50000,
      rating: 4.6,
      prefs: ["Ẩm thực"],
    },
    {
      name: "Azerai La Residence Hue",
      type: "hotel",
      address: "5 Lê Lợi, Huế",
      latOffset: 0.001,
      lngOffset: 0.001,
      description: "Khách sạn 5 sao trong toàn nhà cổ thực dân Pháp bên sông Hương",
      estimatedCost: 4500000,
      rating: 4.8,
      prefs: ["Nghỉ dưỡng", "Lịch sử"],
    },
  ],
  "Ninh Bình": [
    {
      name: "Tràng An",
      type: "attraction",
      address: "Ninh Hải, Hoa Lư, Ninh Bình",
      latOffset: -0.01,
      lngOffset: -0.012,
      description: "Di sản kép UNESCO — đi thuyền tre qua 9 hang động xuyên núi kỳ vĩ",
      estimatedCost: 250000,
      rating: 4.9,
      prefs: ["Núi", "Phiêu lưu", "Nhiếp ảnh"],
    },
    {
      name: "Tam Cốc - Bích Động",
      type: "attraction",
      address: "Ninh Hải, Hoa Lư, Ninh Bình",
      latOffset: -0.02,
      lngOffset: -0.01,
      description: "'Hạ Long trên cạn' với ruộng lúa vàng và 3 hang đá vôi đẹp mê hồn",
      estimatedCost: 195000,
      rating: 4.7,
      prefs: ["Núi", "Thiên nhiên"],
    },
    {
      name: "Chùa Bái Đính",
      type: "attraction",
      address: "Gia Sinh, Gia Viễn, Ninh Bình",
      latOffset: 0.03,
      lngOffset: -0.04,
      description: "Quần thể chùa lớn nhất Đông Nam Á với tượng Phật bằng đồng 100 tấn",
      estimatedCost: 60000,
      rating: 4.6,
      prefs: ["Văn hóa", "Lịch sử"],
    },
    {
      name: "Hang Múa",
      type: "attraction",
      address: "Ninh Xuân, Hoa Lư, Ninh Bình",
      latOffset: -0.015,
      lngOffset: -0.008,
      description: "500 bậc đá lên đỉnh núi ngắm toàn cảnh Tam Cốc — view 'sống ảo' đẹp số 1",
      estimatedCost: 100000,
      rating: 4.7,
      prefs: ["Phiêu lưu", "Nhiếp ảnh"],
    },
    {
      name: "Dê núi Thanh Cao",
      type: "restaurant",
      address: "Tam Cốc, Ninh Bình",
      latOffset: -0.018,
      lngOffset: -0.011,
      description: "Dê núi đặc sản Ninh Bình — tái chanh, hấp lá tía tô, lẩu dê",
      estimatedCost: 350000,
      rating: 4.5,
      prefs: ["Ẩm thực"],
    },
    {
      name: "Tam Coc Garden Resort",
      type: "hotel",
      address: "Hai Nhi, Ninh Hải, Hoa Lư, Ninh Bình",
      latOffset: -0.017,
      lngOffset: -0.009,
      description: "Resort yên tĩnh giữa ruộng lúa, view núi đá vôi, decor truyền thống",
      estimatedCost: 1800000,
      rating: 4.6,
      prefs: ["Nghỉ dưỡng", "Thiên nhiên"],
    },
  ],
};

// 10 sample users với thông tin thật Việt Nam
const SAMPLE_USERS = [
  {
    userName: "tham_nguyen",
    email: "tham.nguyen@gmail.com",
    fullName: "Nguyễn Thị Thắm",
    avatar: "https://i.pravatar.cc/200?img=1",
  },
  {
    userName: "minh_tran",
    email: "minh.tran@gmail.com",
    fullName: "Trần Văn Minh",
    avatar: "https://i.pravatar.cc/200?img=12",
  },
  {
    userName: "linh_pham",
    email: "linh.pham@gmail.com",
    fullName: "Phạm Khánh Linh",
    avatar: "https://i.pravatar.cc/200?img=5",
  },
  {
    userName: "hung_le",
    email: "hung.le@gmail.com",
    fullName: "Lê Quốc Hùng",
    avatar: "https://i.pravatar.cc/200?img=14",
  },
  {
    userName: "mai_nguyen",
    email: "mai.nguyen@gmail.com",
    fullName: "Nguyễn Thị Mai",
    avatar: "https://i.pravatar.cc/200?img=9",
  },
  {
    userName: "duy_dang",
    email: "duy.dang@gmail.com",
    fullName: "Đặng Bảo Duy",
    avatar: "https://i.pravatar.cc/200?img=11",
  },
  {
    userName: "hoa_vo",
    email: "hoa.vo@gmail.com",
    fullName: "Võ Thị Thu Hoa",
    avatar: "https://i.pravatar.cc/200?img=20",
  },
  {
    userName: "tuan_bui",
    email: "tuan.bui@gmail.com",
    fullName: "Bùi Anh Tuấn",
    avatar: "https://i.pravatar.cc/200?img=15",
  },
  {
    userName: "trang_do",
    email: "trang.do@gmail.com",
    fullName: "Đỗ Thuỳ Trang",
    avatar: "https://i.pravatar.cc/200?img=10",
  },
  {
    userName: "nam_phan",
    email: "nam.phan@gmail.com",
    fullName: "Phan Hoài Nam",
    avatar: "https://i.pravatar.cc/200?img=13",
  },
];

const TRIP_TITLES = [
  "Khám phá Hà Nội cổ kính",
  "Đà Nẵng - Hội An 4 ngày 3 đêm",
  "Sa Pa mùa lúa chín",
  "Phú Quốc nghỉ dưỡng cuối tuần",
  "Đà Lạt mộng mơ tháng 12",
  "Vịnh Hạ Long du thuyền sang chảnh",
  "Hành trình di sản miền Trung",
  "Sài Gòn - Vũng Tàu cuối tuần",
  "Phong Nha hang động kỳ vĩ",
  "Ninh Bình - Tràng An 2 ngày 1 đêm",
  "Tour ẩm thực Hà Nội 3 ngày",
  "Nha Trang nắng vàng biển xanh",
  "Mộc Châu mùa hoa cải",
  "Cần Thơ miền Tây sông nước",
  "Huế cố đô và đặc sản cung đình",
];

const REVIEW_COMMENTS = [
  "Cảnh đẹp tuyệt vời, nhất định sẽ quay lại! Khách sạn dịch vụ tốt, ăn uống ngon. Recommend cho mọi người.",
  "Trải nghiệm tuyệt vời cùng gia đình. Trẻ con rất thích thú với các hoạt động. Sẽ đi lại vào năm sau.",
  "Cảnh thiên nhiên hoang sơ, không khí trong lành. Ẩm thực địa phương ngon, người dân thân thiện.",
  "Một chuyến đi đáng nhớ. Hướng dẫn viên chu đáo, lịch trình hợp lý. 5 sao cho mọi thứ!",
  "View đẹp quá xá, chụp ảnh sống ảo cháy máy luôn. Đồ ăn ngon, không gian thoáng mát.",
  "Khá hài lòng với chuyến đi. Một vài điểm cần cải thiện về dịch vụ nhưng tổng thể OK.",
  "Đáng đồng tiền bát gạo. Resort sang trọng, bữa sáng buffet phong phú, hồ bơi vô cực đẹp.",
  "Cảnh đẹp ngoài sức tưởng tượng. Khách sạn sạch sẽ, nhân viên nhiệt tình. Chỉ tiếc thời gian quá ngắn.",
  "Chuyến đi tuyệt vời với bạn bè. Ăn uống ngon, giá cả phải chăng. Sẽ quay lại sớm thôi!",
  "Đẹp lung linh, thiên nhiên kỳ vĩ. Trekking hơi mệt nhưng rất xứng đáng với view trên đỉnh.",
  "Phù hợp cho honeymoon. Lãng mạn, riêng tư, dịch vụ chu đáo. Cảm ơn team đã tổ chức chu đáo.",
  "Trải nghiệm văn hóa địa phương rất thú vị. Gặp gỡ người dân, học làm món ăn truyền thống. Đáng nhớ!",
];

// ══════════════════════════════════════════════════════════════
// MAIN
// ══════════════════════════════════════════════════════════════

async function main() {
  console.log("🌱 Bắt đầu seed realistic data...\n");

  // 1. Clear data cũ (giữ admin user + lookup tables)
  console.log("🧹 Xóa data cũ (giữ admin + lookup tables)...");
  await db.delete(notifications);
  await db.delete(itemReviews);
  await db.delete(tripReviews);
  await db.delete(expenses);
  await db.delete(itineraryItems);
  await db.delete(itineraryDay);
  await db.delete(tripPreferences);
  await db.delete(tripMembers);
  await db.delete(trips);
  await db.delete(poiPreferences);
  await db.delete(poiOpeningHours);
  await db.delete(pois);
  await db.delete(destinations);
  await db.execute(sql`DELETE FROM users WHERE role != 'admin'`);
  console.log("✅ Đã xóa data cũ\n");

  // 2. Load lookup tables
  const destTypes = await db.select().from(destinationType);
  const poiTypes = await db.select().from(poiType);
  const prefs = await db.select().from(preferences);

  const destTypeMap = new Map(destTypes.map((t) => [t.typeName, t.destinationtypeId]));
  const poiTypeMap = new Map(poiTypes.map((t) => [t.typeName, t.poitypeId]));
  const prefMap = new Map(prefs.map((p) => [p.preferenceName, p.preferenceId]));

  // 3. Insert users
  console.log("👥 Tạo 10 sample users...");
  const hashed = await bcrypt.hash("password123", 10);
  const insertedUsers = await db
    .insert(users)
    .values(
      SAMPLE_USERS.map((u) => ({
        userName: u.userName,
        email: u.email,
        password: hashed,
        role: "user",
        status: "active",
        avatarUrl: u.avatar,
        emailVerified: true,
      })),
    )
    .returning();
  console.log(`✅ Tạo ${insertedUsers.length} users (mật khẩu chung: password123)\n`);

  // 4. Insert destinations
  console.log("🌍 Tạo 15 destinations...");
  const insertedDests = await db
    .insert(destinations)
    .values(
      DESTINATIONS_DATA.map((d) => ({
        destinationTypeId: destTypeMap.get(d.typeName) ?? null,
        name: d.name,
        description: d.description,
        address: d.address,
        latitude: d.latitude,
        longitude: d.longitude,
        images: d.images,
        rating: d.rating,
        reviewCounts: Math.floor(Math.random() * 200) + 50,
        active: true,
      })),
    )
    .returning();
  console.log(`✅ Tạo ${insertedDests.length} destinations\n`);

  const destByName = new Map(insertedDests.map((d) => [d.name, d]));

  // 5. Insert POIs
  console.log("📍 Tạo POIs cho từng destination...");
  let totalPois = 0;
  for (const [destName, poiList] of Object.entries(POIS_BY_DEST)) {
    const dest = destByName.get(destName);
    if (!dest || dest.latitude == null || dest.longitude == null) continue;
    const baseLat = parseFloat(dest.latitude);
    const baseLng = parseFloat(dest.longitude);

    const inserted = await db
      .insert(pois)
      .values(
        poiList.map((p) => ({
          poitypeId: poiTypeMap.get(p.type) ?? null,
          destinationId: dest.destinationId,
          name: p.name,
          latitude: (baseLat + p.latOffset).toFixed(8),
          longitude: (baseLng + p.lngOffset).toFixed(8),
          address: p.address,
          estimatedCost: p.estimatedCost.toString(),
          rating: p.rating.toString(),
          reviewCounts: Math.floor(Math.random() * 100) + 20,
          description: p.description,
        })),
      )
      .returning();

    // Add preferences for each POI
    for (let i = 0; i < inserted.length; i++) {
      const poi = inserted[i];
      const poiData = poiList[i];
      if (!poiData.prefs) continue;
      for (const prefName of poiData.prefs) {
        const prefId = prefMap.get(prefName);
        if (prefId) {
          try {
            await db.insert(poiPreferences).values({ poiId: poi.poiId, preferenceId: prefId });
          } catch {
            /* skip dup */
          }
        }
      }
    }

    // Add opening hours (8-22 every day for most, custom for hotels)
    for (const poi of inserted) {
      const isHotel = poiList.find((p) => p.name === poi.name)?.type === "hotel";
      for (let day = 0; day < 7; day++) {
        try {
          await db.insert(poiOpeningHours).values({
            poiId: poi.poiId,
            dayOfWeek: day,
            openTime: isHotel ? "00:00:00" : "08:00:00",
            closeTime: isHotel ? "23:59:00" : "22:00:00",
          });
        } catch {
          /* skip dup */
        }
      }
    }

    totalPois += inserted.length;
  }
  console.log(`✅ Tạo ${totalPois} POIs (kèm preferences + opening hours)\n`);

  // 6. Insert trips
  console.log("✈️ Tạo 15 sample trips...");
  const tripsToInsert: any[] = [];
  for (let i = 0; i < 15; i++) {
    const owner = pickRandom(insertedUsers);
    const dest = pickRandom(insertedDests);
    const numDays = Math.floor(Math.random() * 5) + 2; // 2-6 ngày
    const startDate = new Date();
    startDate.setDate(startDate.getDate() + Math.floor(Math.random() * 60) - 30); // -30 đến +30 ngày
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + numDays - 1);

    const statuses = ["draft", "active", "completed"];
    const status =
      startDate > new Date() ? "draft" : endDate < new Date() ? "completed" : pickRandom(statuses);

    tripsToInsert.push({
      destinationId: dest.destinationId,
      ownerId: owner.userId,
      title: TRIP_TITLES[i % TRIP_TITLES.length],
      startDate: startDate.toISOString().split("T")[0],
      endDate: endDate.toISOString().split("T")[0],
      budget: (Math.floor(Math.random() * 15) + 3) * 1000000, // 3-18 triệu
      numPeople: Math.floor(Math.random() * 5) + 1,
      status,
    });
  }
  const insertedTrips = await db.insert(trips).values(tripsToInsert).returning();
  console.log(`✅ Tạo ${insertedTrips.length} trips\n`);

  // 7. Insert trip days + items
  console.log("📅 Tạo itinerary days + items cho mỗi trip...");
  let totalDays = 0;
  let totalItems = 0;
  for (const trip of insertedTrips) {
    if (!trip.startDate || !trip.endDate) continue;
    const start = new Date(trip.startDate);
    const end = new Date(trip.endDate);
    const numDays = Math.ceil((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000)) + 1;

    const tripDest = insertedDests.find((d) => d.destinationId === trip.destinationId);
    if (!tripDest) continue;
    const destPois = await db
      .select()
      .from(pois)
      .where(eq(pois.destinationId, tripDest.destinationId));
    if (destPois.length === 0) continue;

    for (let d = 0; d < numDays; d++) {
      const dayDate = new Date(start);
      dayDate.setDate(dayDate.getDate() + d);
      const [day] = await db
        .insert(itineraryDay)
        .values({
          tripId: trip.tripId,
          date: dayDate.toISOString().split("T")[0],
          dayIndex: d + 1,
        })
        .returning();
      totalDays++;

      // 3-5 activities per day
      const selectedPois = pickN(destPois, Math.floor(Math.random() * 3) + 3);
      const times = ["08:00", "10:30", "12:30", "14:30", "17:00", "19:30"];
      for (let i = 0; i < selectedPois.length; i++) {
        const poi = selectedPois[i];
        await db.insert(itineraryItems).values({
          dayId: day.dayId,
          tripId: trip.tripId,
          poiId: poi.poiId,
          customName: poi.name,
          startTime: times[i] + ":00",
          duration: 90,
          orderIndex: i,
          estimatedCost: poi.estimatedCost,
          status: trip.status === "completed" ? "completed" : "pending",
        });
        totalItems++;
      }
    }
  }
  console.log(`✅ Tạo ${totalDays} days + ${totalItems} activities\n`);

  // 8. Insert reviews on trips + items
  console.log("⭐ Tạo reviews trên trips + items...");
  const completedTrips = insertedTrips.filter((t) => t.status === "completed");
  let tripReviewsCount = 0;
  for (const trip of completedTrips) {
    // Owner reviews
    if (trip.ownerId) {
      try {
        await db.insert(tripReviews).values({
          userId: trip.ownerId,
          tripId: trip.tripId,
          rating: (Math.floor(Math.random() * 2) + 4).toString(), // 4-5
          comment: pickRandom(REVIEW_COMMENTS),
        });
        tripReviewsCount++;
      } catch {
        /* skip dup */
      }
    }
    // 1-2 additional reviews from other users
    const otherUsers = pickN(
      insertedUsers.filter((u) => u.userId !== trip.ownerId),
      2,
    );
    for (const u of otherUsers) {
      try {
        await db.insert(tripReviews).values({
          userId: u.userId,
          tripId: trip.tripId,
          rating: (Math.floor(Math.random() * 2) + 4).toString(),
          comment: pickRandom(REVIEW_COMMENTS),
        });
        tripReviewsCount++;
      } catch {
        /* skip dup */
      }
    }
  }
  console.log(`✅ Tạo ${tripReviewsCount} trip reviews\n`);

  // 9. Insert notifications
  console.log("🔔 Tạo notifications...");
  const notifTemplates = [
    {
      title: "Chuyến đi sắp tới",
      message: "Chuyến đi của bạn còn 3 ngày nữa! Đã sẵn sàng chưa?",
      type: "info",
    },
    {
      title: "Lịch trình AI đã sẵn sàng",
      message: "AI đã tạo xong lịch trình cho chuyến đi của bạn. Vào xem nhé!",
      type: "success",
    },
    {
      title: "Có người tham gia chuyến đi",
      message: "Bạn vừa được mời tham gia một chuyến đi mới",
      type: "info",
    },
    {
      title: "Chuyến đi đã hoàn thành",
      message: "Hãy đánh giá chuyến đi để chia sẻ trải nghiệm với cộng đồng",
      type: "info",
    },
    {
      title: "Khám phá điểm đến mới",
      message: "Đà Nẵng mới được thêm vào với nhiều điểm tham quan thú vị",
      type: "info",
    },
  ];
  let notifCount = 0;
  for (const user of insertedUsers) {
    const numNotifs = Math.floor(Math.random() * 4) + 2;
    for (let i = 0; i < numNotifs; i++) {
      const tpl = pickRandom(notifTemplates);
      const trip = pickRandom(insertedTrips.filter((t) => t.ownerId === user.userId));
      await db.insert(notifications).values({
        userId: user.userId,
        tripId: trip?.tripId ?? null,
        title: tpl.title,
        message: tpl.message,
        type: tpl.type,
        isRead: Math.random() > 0.5,
      });
      notifCount++;
    }
  }
  console.log(`✅ Tạo ${notifCount} notifications\n`);

  console.log("🎉 SEED DATA HOÀN TẤT!\n");
  console.log("📊 Tổng kết:");
  console.log(`   - ${insertedUsers.length} users (password: password123)`);
  console.log(`   - ${insertedDests.length} destinations`);
  console.log(`   - ${totalPois} POIs`);
  console.log(`   - ${insertedTrips.length} trips (${completedTrips.length} completed)`);
  console.log(`   - ${totalDays} itinerary days + ${totalItems} activities`);
  console.log(`   - ${tripReviewsCount} reviews`);
  console.log(`   - ${notifCount} notifications`);
  console.log("\nDanh sách users:");
  for (const u of SAMPLE_USERS.slice(0, 3)) {
    console.log(`   - ${u.email} / password123`);
  }
  console.log("   ... (10 user tổng)\n");

  await pool.end();
}

main().catch((err) => {
  console.error("❌ Seed failed:", err);
  pool.end();
  process.exit(1);
});
