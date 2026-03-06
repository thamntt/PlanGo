import type { Destination } from "./storage";

export const PREFERENCE_OPTIONS = [
  "Beach",
  "Mountain",
  "City",
  "Culture",
  "Food",
  "Adventure",
  "Relaxation",
  "Nature",
  "History",
  "Shopping",
  "Nightlife",
  "Photography",
];

export const CATEGORIES = [
  "Beach",
  "Mountain",
  "City",
  "Cultural",
  "Nature",
  "Adventure",
  "Historical",
];

export const BUDGET_OPTIONS = [
  "< 2M VND",
  "2-5M VND",
  "5-10M VND",
  "10-20M VND",
  "> 20M VND",
];

export const SEED_DESTINATIONS: Destination[] = [
  {
    id: "dest_1",
    name: "Ha Long Bay",
    description:
      "Ha Long Bay is a UNESCO World Heritage Site featuring thousands of limestone karsts and islands in various shapes and sizes. The bay has an area of around 1,553 km2, including 1,960-2,000 islets, most of which are limestone. The spectacular scenery of limestone pillars makes it one of the most popular travel destinations in Vietnam.",
    images: [
      "https://images.unsplash.com/photo-1528127269322-539801943592?w=800",
      "https://images.unsplash.com/photo-1573790387438-4da905039392?w=800",
    ],
    category: "Nature",
    address: "Quang Ninh Province, Vietnam",
    latitude: 20.9101,
    longitude: 107.1839,
    rating: 4.8,
    reviewCount: 2456,
    priceRange: "5-10M VND",
    tags: ["UNESCO", "Cruise", "Kayaking", "Cave"],
    openHours: "Open 24 hours",
    isActive: true,
  },
  {
    id: "dest_2",
    name: "Hoi An Ancient Town",
    description:
      "Hoi An is an exceptionally well-preserved example of a South-East Asian trading port dating from the 15th to 19th century. Its buildings and street plan reflect the influences of indigenous and foreign cultures. The town is a living museum of architecture, cuisine, and cultural heritage.",
    images: [
      "https://images.unsplash.com/photo-1559592413-7cec4d0cae2b?w=800",
      "https://images.unsplash.com/photo-1583417319070-4a69db38a482?w=800",
    ],
    category: "Cultural",
    address: "Hoi An, Quang Nam, Vietnam",
    latitude: 15.8801,
    longitude: 108.338,
    rating: 4.7,
    reviewCount: 1893,
    priceRange: "2-5M VND",
    tags: ["UNESCO", "Lanterns", "Tailoring", "Food"],
    openHours: "Open 24 hours",
    isActive: true,
  },
  {
    id: "dest_3",
    name: "Sapa",
    description:
      "Sapa is a town in the Hoang Lien Son Mountains of northwestern Vietnam. A popular trekking base, it overlooks the terraced rice fields of the Muong Hoa Valley. The region is home to ethnic minority groups, including the Hmong and Dao people, offering unique cultural experiences.",
    images: [
      "https://images.unsplash.com/photo-1570366583862-f91883984fde?w=800",
      "https://images.unsplash.com/photo-1528181304800-259b08848526?w=800",
    ],
    category: "Mountain",
    address: "Lao Cai Province, Vietnam",
    latitude: 22.3364,
    longitude: 103.8438,
    rating: 4.6,
    reviewCount: 1567,
    priceRange: "2-5M VND",
    tags: ["Trekking", "Rice Terraces", "Culture", "Mountain"],
    openHours: "Open 24 hours",
    isActive: true,
  },
  {
    id: "dest_4",
    name: "Phu Quoc Island",
    description:
      "Phu Quoc is the largest island in Vietnam, known for its white-sand beaches, coral reefs, and dense tropical jungle. The island offers a perfect blend of relaxation and adventure with snorkeling, diving, and the famous Phu Quoc fish sauce factories.",
    images: [
      "https://images.unsplash.com/photo-1559628376-f3fe5f782a2e?w=800",
      "https://images.unsplash.com/photo-1540611025311-01df3cee54b5?w=800",
    ],
    category: "Beach",
    address: "Kien Giang Province, Vietnam",
    latitude: 10.2899,
    longitude: 103.9840,
    rating: 4.5,
    reviewCount: 2103,
    priceRange: "5-10M VND",
    tags: ["Beach", "Snorkeling", "Sunset", "Seafood"],
    openHours: "Open 24 hours",
    isActive: true,
  },
  {
    id: "dest_5",
    name: "Da Nang",
    description:
      "Da Nang is a coastal city in central Vietnam known for its sandy beaches and history as a French colonial port. It is a gateway to the Marble Mountains, five limestone and marble hills with caves and Buddhist shrines. The Dragon Bridge and Ba Na Hills are must-visit attractions.",
    images: [
      "https://images.unsplash.com/photo-1559592413-7cec4d0cae2b?w=800",
      "https://images.unsplash.com/photo-1464817739973-0128fe77aaa1?w=800",
    ],
    category: "City",
    address: "Da Nang, Vietnam",
    latitude: 16.0544,
    longitude: 108.2022,
    rating: 4.5,
    reviewCount: 1789,
    priceRange: "2-5M VND",
    tags: ["Beach", "Bridge", "Ba Na Hills", "Marble Mountains"],
    openHours: "Open 24 hours",
    isActive: true,
  },
  {
    id: "dest_6",
    name: "Ninh Binh",
    description:
      "Ninh Binh is known as 'Ha Long Bay on land' for its dramatic limestone karst landscapes. The province features the ancient capital of Hoa Lu, Trang An Landscape Complex (UNESCO), and Tam Coc with its boat rides through caves and rice paddies.",
    images: [
      "https://images.unsplash.com/photo-1573790387438-4da905039392?w=800",
      "https://images.unsplash.com/photo-1528127269322-539801943592?w=800",
    ],
    category: "Nature",
    address: "Ninh Binh Province, Vietnam",
    latitude: 20.2506,
    longitude: 105.9745,
    rating: 4.6,
    reviewCount: 1234,
    priceRange: "2-5M VND",
    tags: ["UNESCO", "Boat", "Cave", "Temple"],
    openHours: "6:00 AM - 6:00 PM",
    isActive: true,
  },
  {
    id: "dest_7",
    name: "Dalat",
    description:
      "Known as the 'City of Eternal Spring', Dalat is a hill station in the Central Highlands of Vietnam. Famous for its French colonial architecture, flower gardens, lakes, and waterfalls, Dalat offers a cooler climate and a romantic atmosphere perfect for couples.",
    images: [
      "https://images.unsplash.com/photo-1528181304800-259b08848526?w=800",
      "https://images.unsplash.com/photo-1570366583862-f91883984fde?w=800",
    ],
    category: "Mountain",
    address: "Lam Dong Province, Vietnam",
    latitude: 11.9404,
    longitude: 108.4583,
    rating: 4.4,
    reviewCount: 1678,
    priceRange: "2-5M VND",
    tags: ["Flowers", "Waterfall", "Coffee", "Romance"],
    openHours: "Open 24 hours",
    isActive: true,
  },
  {
    id: "dest_8",
    name: "Hue Imperial City",
    description:
      "The Imperial City in Hue is a walled fortress and palace in the former capital of Vietnam. A UNESCO World Heritage Site, it served as the seat of the Nguyen Dynasty from 1802 to 1945. The complex includes the Forbidden Purple City, royal tombs, and pagodas.",
    images: [
      "https://images.unsplash.com/photo-1583417319070-4a69db38a482?w=800",
      "https://images.unsplash.com/photo-1559592413-7cec4d0cae2b?w=800",
    ],
    category: "Historical",
    address: "Hue, Thua Thien Hue, Vietnam",
    latitude: 16.4698,
    longitude: 107.5792,
    rating: 4.5,
    reviewCount: 1456,
    priceRange: "< 2M VND",
    tags: ["UNESCO", "Palace", "History", "Architecture"],
    openHours: "7:00 AM - 5:30 PM",
    isActive: true,
  },
  {
    id: "dest_9",
    name: "Nha Trang",
    description:
      "Nha Trang is a coastal resort city in southern Vietnam known for its beaches, diving sites, and offshore islands. The city offers a vibrant nightlife, seafood restaurants, and historical Cham ruins. VinWonders amusement park on Hon Tre island is a major attraction.",
    images: [
      "https://images.unsplash.com/photo-1559628376-f3fe5f782a2e?w=800",
      "https://images.unsplash.com/photo-1540611025311-01df3cee54b5?w=800",
    ],
    category: "Beach",
    address: "Khanh Hoa Province, Vietnam",
    latitude: 12.2388,
    longitude: 109.1967,
    rating: 4.3,
    reviewCount: 1890,
    priceRange: "2-5M VND",
    tags: ["Beach", "Diving", "Island", "Nightlife"],
    openHours: "Open 24 hours",
    isActive: true,
  },
  {
    id: "dest_10",
    name: "Phong Nha-Ke Bang",
    description:
      "Phong Nha-Ke Bang National Park is a UNESCO World Heritage Site home to the world's largest cave, Son Doong. The park features spectacular cave systems, underground rivers, and pristine jungle. Adventure seekers can explore various caves from easy walks to multi-day expeditions.",
    images: [
      "https://images.unsplash.com/photo-1573790387438-4da905039392?w=800",
      "https://images.unsplash.com/photo-1528127269322-539801943592?w=800",
    ],
    category: "Adventure",
    address: "Quang Binh Province, Vietnam",
    latitude: 17.5922,
    longitude: 106.2834,
    rating: 4.7,
    reviewCount: 987,
    priceRange: "5-10M VND",
    tags: ["UNESCO", "Cave", "Adventure", "Jungle"],
    openHours: "7:00 AM - 4:30 PM",
    isActive: true,
  },
];

export const SEED_ADMIN: {
  username: string;
  password: string;
  email: string;
  fullName: string;
  role: "admin";
} = {
  username: "admin",
  password: "admin123",
  email: "admin@plango.vn",
  fullName: "PlanGo Admin",
  role: "admin",
};
