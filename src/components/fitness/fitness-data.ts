// Iron Forge — dữ liệu thương hiệu (nội dung marketing, copy tiếng Việt)

export const REEL_IMAGES = [
  "/fitness/img/hero-5.jpg",
  "/fitness/img/hero-6.jpg",
  "/fitness/img/hero-8.jpg",
  "/fitness/img/hero-7.jpg",
];

export const REEL_VOICE = "/fitness/audio/hero-voice.wav";

export const BRAND_STATS = [
  { value: "2.400+", label: "Hội viên đang tập" },
  { value: "18", label: "HLV chứng nhận quốc tế" },
  { value: "12", label: "Năm rèn luyện" },
  { value: "4.9/5", label: "Đánh giá hội viên" },
] as const;

export interface Coach {
  id: string;
  name: string;
  role: string;
  photo: string;
  years: string;
  certs: string[];
  background: string;
  signature: string;
  specialties: string[];
}

export const COACHES: Coach[] = [
  {
    id: "bao",
    name: "Trần Quốc Bảo",
    role: "HLV Trưởng — Sức mạnh",
    photo: "/fitness/img/coach-3.jpg",
    years: "9 năm",
    certs: ["NSCA-CSCS", "USA Weightlifting L2", "Chứng chỉ Sức mạnh Quốc gia Cấp 1"],
    background:
      "Cựu vận động viên cử tạ đội tuyển TP.HCM, 6 năm gánh vị trí HLV trưởng phụ trách nhóm sức mạnh. Theo dõi trực tiếp hơn 300 hội viên từ người mới đến vận động viên thi đấu.",
    signature: "5×5 FORGE — squat / bench / deadlift chuẩn hình, tăng tải mỗi tuần",
    specialties: ["Cử tạ", "Tăng lực", "Kỹ thuật compound"],
  },
  {
    id: "tuan",
    name: "Lê Minh Tuấn",
    role: "HLV Tăng cơ & Dinh dưỡng",
    photo: "/fitness/img/coach-7.jpg",
    years: "7 năm",
    certs: ["ACE-CPT", "Precision Nutrition L1", "ISSA Bodybuilding Specialist"],
    background:
      "Tốt nghiệp Sư phạm Thể thao, tư vấn dinh dưỡng cho hơn 500 hội viên tăng khối cơ. Chuyên kiểm tra InBody và tinh chỉnh macro theo từng giai đoạn 4 tuần.",
    signature: "BI-FORGE SPLIT — chia đẩy / kéo / chân, superset hoàn lưu máu",
    specialties: ["Hypertrophy", "Dinh dưỡng", "Đo InBody"],
  },
  {
    id: "maianh",
    name: "Nguyễn Mai Anh",
    role: "HLV Giảm mỡ & HIIT",
    photo: "/fitness/img/coach-11.png",
    years: "6 năm",
    certs: ["NASM-CPT", "Kettlebell Concepts L1", "CPR/AED — Hội Tim mạch học VN"],
    background:
      "Võ sinh Taekwondo đai đen, chuyển sang huấn luyện giảm mỡ kết hợp sức mạnh tim mạch. Lớp HIIT của cô luôn duy trì đốt 500–700 kcal mỗi buổi.",
    signature: "METCON 45 — 12 trạm vòng tròn, cường độ theo nhịp tim mục tiêu",
    specialties: ["HIIT", "Giảm mỡ", "Sức bền tim mạch"],
  },
  {
    id: "thuha",
    name: "Phạm Thu Hà",
    role: "HLV Thể lực & Phục hồi",
    photo: "/fitness/img/coach-1.jpg",
    years: "8 năm",
    certs: ["FMS Level 2", "RYT-200 Yoga Alliance", "Anatomy Trains — Fascia cơ bản"],
    background:
      "8 năm đồng hành cùng hội viên trung niên và người đau lưng, vai gáy văn phòng. Xây kế hoạch vận động an toàn, khớp linh hoạt trước khi tăng tải.",
    signature: "MOBILITY FLOW — mở khớp + lõi trung tâm trước mọi buổi nặng",
    specialties: ["Phục hồi", "Mobility", "Tư thế văn phòng"],
  },
];

export interface Program {
  id: string;
  goal: string;
  title: string;
  duration: string;
  image: string;
  intensity: string;
  desc: string;
  details: { label: string; value: string }[];
  phases: string[];
  price: string;
}

export const PROGRAMS: Program[] = [
  {
    id: "muscle",
    goal: "TĂNG CƠ",
    title: "Hypertrophy Forge",
    duration: "12 tuần",
    image: "/fitness/img/gym-2.jpg",
    intensity: "Cường độ: 4 buổi/tuần",
    desc: "Lộ trình tăng khối cơ chuẩn khoa học: chia bài đẩy–kéo–chân, tăng tiến tải từng tuần, đo InBody định kỳ để tinh chỉnh.",
    details: [
      { label: "Tần suất", value: "4 buổi/tuần · 75 phút" },
      { label: "Phương pháp", value: "Progressive overload + superset" },
      { label: "Đo lường", value: "InBody 2 lần/tháng" },
      { label: "Dinh dưỡng", value: "Macro theo giai đoạn" },
    ],
    phases: ["Giai đoạn 1 — nền tảng 4 tuần", "Giai đoạn 2 — khối lượng 5 tuần", "Giai đoạn 3 — đỉnh & giữ cơ 3 tuần"],
    price: "2.400.000đ / 12 tuần",
  },
  {
    id: "fatloss",
    goal: "GIẢM MỢ",
    title: "Fat Loss Protocol",
    duration: "8 tuần",
    image: "/fitness/img/hiit-2.jpg",
    intensity: "Cường độ: 5 buổi/tuần",
    desc: "Combo HIIT + sức mạnh giữ cơ trong thâm hụt calories. Mỗi buổi đốt 500–700 kcal, nhịp tim được giám sát theo vùng mục tiêu.",
    details: [
      { label: "Tần suất", value: "5 buổi/tuần · 45 phút" },
      { label: "Phương pháp", value: "HIIT 12 trạm + resistance" },
      { label: "Giám sát", value: "Nhịp tim theo vùng mục tiêu" },
      { label: "Dinh dưỡng", value: "Thâm hụt 300–500 kcal/ngày" },
    ],
    phases: ["Giai đoạn 1 — khởi động chuyển hoá 3 tuần", "Giai đoạn 2 — đốt mạnh 3 tuần", "Giai đoạn 3 — giữ dáng 2 tuần"],
    price: "1.900.000đ / 8 tuần",
  },
  {
    id: "fitness",
    goal: "THỂ LỰC",
    title: "Conditioning & Mobility",
    duration: "Liên tục",
    image: "/fitness/img/coach-8.jpg",
    intensity: "Cường độ: 3 buổi/tuần",
    desc: "Nâng VO₂ max, bền cơ, khớp linh hoạt — nền móng cho mọi bộ môn. Bài tập chức năng, calisthenics và phòng chấn thương.",
    details: [
      { label: "Tần suất", value: "3 buổi/tuần · 60 phút" },
      { label: "Phương pháp", value: "Calisthenics + EMOM" },
      { label: "Mục tiêu", value: "VO₂ max, bền lõi" },
      { label: "Bổ trợ", value: "Mobility + foam rolling" },
    ],
    phases: ["Đánh giá chuyển động ban đầu", "Chu kỳ 8 tuần xoay vòng", "Kiểm thử thể lực mỗi 2 tháng"],
    price: "1.200.000đ / tháng",
  },
];

export interface Story {
  id: string;
  name: string;
  age: string;
  goal: string;
  image: string;
  quote: string;
  results: { value: string; label: string }[];
  duration: string;
}

export const STORIES: Story[] = [
  {
    id: "nhat",
    name: "Minh Nhật",
    age: "34 tuổi",
    goal: "Giảm mỡ",
    image: "/fitness/img/member-3.jpg",
    quote:
      "Ngày đầu tôi không chạy nổi 5 phút. HLV Mai Anh chia nhỏ mục tiêu từng tuần, đến tháng thứ 6 tôi giảm 18kg và ngủ ngon hơn hẳn.",
    results: [
      { value: "−18kg", label: "Cân nặng" },
      { value: "−11%", label: "Mỡ cơ thể" },
      { value: "6 tháng", label: "Thời gian" },
    ],
    duration: "6 tháng với Fat Loss Protocol",
  },
  {
    id: "trang",
    name: "Thu Trang",
    age: "29 tuổi",
    goal: "Tăng cơ",
    image: "/fitness/img/member-2.jpg",
    quote:
      "Tôi sợ 'to cơ' lắm, nhưng HLV Tuấn giải thích tăng cơ là lên dáng, không phải to. 8 tháng sau tôi squat 100kg và tự tin hơn rất nhiều.",
    results: [
      { value: "+6,2kg", label: "Khối cơ" },
      { value: "100kg", label: "Squat tối đa" },
      { value: "8 tháng", label: "Thời gian" },
    ],
    duration: "8 tháng với Hypertrophy Forge",
  },
  {
    id: "huy",
    name: "Quốc Huy",
    age: "26 tuổi",
    goal: "Tăng cân",
    image: "/fitness/img/member-4.jpg",
    quote:
      "76kg gầy 10 năm không lên nổi ký nào. Chương trình ăn + tập đúng kỹ thuật của anh Bảo giúp tôi lên 88kg, cơ mà không mỡ.",
    results: [
      { value: "+12kg", label: "Cân nặng" },
      { value: "+8,5kg", label: "Khối cơ" },
      { value: "10 tháng", label: "Thời gian" },
    ],
    duration: "10 tháng với Hypertrophy Forge",
  },
  {
    id: "lananh",
    name: "Lan Anh",
    age: "41 tuổi",
    goal: "Phục hồi",
    image: "/fitness/img/coach-5.jpeg",
    quote:
      "Đau lưng 5 năm vì ngồi văn phòng. Chị Hà dạy mình cách mở khớp, mạnh lõi lại. Buổi chạy 10km đầu tiên ở tuổi 41 — tôi khóc thật.",
    results: [
      { value: "0 → 10km", label: "Chạy bộ" },
      { value: "Hết", label: "Đau lưng mãn" },
      { value: "9 tháng", label: "Thời gian" },
    ],
    duration: "9 tháng với Conditioning & Mobility",
  },
];

export const GOAL_OPTIONS = [
  { value: "muscle", label: "Tăng cơ — Hypertrophy Forge" },
  { value: "fatloss", label: "Giảm mỡ — Fat Loss Protocol" },
  { value: "fitness", label: "Thể lực — Conditioning & Mobility" },
] as const;

export const TIME_OPTIONS = [
  { value: "morning", label: "Sáng · 06:00 – 09:00" },
  { value: "noon", label: "Trưa · 11:00 – 14:00" },
  { value: "afternoon", label: "Chiều · 14:00 – 18:00" },
  { value: "evening", label: "Tối · 18:00 – 22:00" },
] as const;
