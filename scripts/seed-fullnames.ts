/**
 * Backfill `full_name` for existing users.
 * Maps Vietnamese slug-style usernames to proper full names with diacritics.
 * Run: npx tsx scripts/seed-fullnames.ts
 */
import "dotenv/config";
import pg from "pg";

// Manual map for the specific seed accounts (so they look natural in app)
const KNOWN_NAMES: Record<string, string> = {
  admin: "Quản trị viên",
  thamnt123: "Nguyễn Thị Thắm",
  tham_nguyen: "Nguyễn Thị Thắm",
  minh_tran: "Trần Văn Minh",
  linh_pham: "Phạm Thuỳ Linh",
  hung_le: "Lê Quang Hùng",
  mai_nguyen: "Nguyễn Thị Mai",
  duy_dang: "Đặng Anh Duy",
  hoa_vo: "Võ Thị Hoa",
  tuan_bui: "Bùi Minh Tuấn",
  trang_do: "Đỗ Thuỳ Trang",
  nam_phan: "Phan Hoài Nam",
};

// Last-name → Vietnamese surname map
const SURNAMES: Record<string, string> = {
  nguyen: "Nguyễn",
  tran: "Trần",
  le: "Lê",
  pham: "Phạm",
  hoang: "Hoàng",
  huynh: "Huỳnh",
  phan: "Phan",
  vu: "Vũ",
  vo: "Võ",
  dang: "Đặng",
  bui: "Bùi",
  do: "Đỗ",
  ho: "Hồ",
  ngo: "Ngô",
  duong: "Dương",
  ly: "Lý",
  truong: "Trương",
};

// Given-name → with-diacritics
const GIVEN_NAMES: Record<string, string> = {
  tham: "Thắm",
  minh: "Minh",
  linh: "Linh",
  hung: "Hùng",
  mai: "Mai",
  duy: "Duy",
  hoa: "Hoa",
  tuan: "Tuấn",
  trang: "Trang",
  nam: "Nam",
  an: "An",
  binh: "Bình",
  cuong: "Cường",
  dung: "Dũng",
  ha: "Hà",
  huy: "Huy",
  khanh: "Khánh",
  lam: "Lâm",
  long: "Long",
  ngoc: "Ngọc",
  phong: "Phong",
  quang: "Quang",
  thanh: "Thanh",
  thao: "Thảo",
  thu: "Thu",
  thuy: "Thuỳ",
  trung: "Trung",
  tuyet: "Tuyết",
  van: "Văn",
  yen: "Yến",
};

function deriveFullName(userName: string): string {
  if (KNOWN_NAMES[userName]) return KNOWN_NAMES[userName];
  // Try `given_family` pattern
  const parts = userName.split(/[_.-]/).filter(Boolean);
  if (parts.length >= 2) {
    const [given, family] = parts;
    const surname = SURNAMES[family.toLowerCase()] || capitalize(family);
    const givenName = GIVEN_NAMES[given.toLowerCase()] || capitalize(given);
    return `${surname} ${givenName}`;
  }
  return capitalize(userName);
}

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
}

async function main() {
  const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });
  const r = await pool.query(`SELECT user_id, user_name FROM users WHERE full_name IS NULL`);
  console.log(`📝 Backfilling ${r.rows.length} users...\n`);
  for (const u of r.rows) {
    const fullName = deriveFullName(u.user_name);
    await pool.query(`UPDATE users SET full_name = $1 WHERE user_id = $2`, [fullName, u.user_id]);
    console.log(`   ${u.user_name.padEnd(20)} → ${fullName}`);
  }
  console.log(`\n✅ Done`);
  await pool.end();
}

main().catch((err) => {
  console.error("❌", err);
  process.exit(1);
});
