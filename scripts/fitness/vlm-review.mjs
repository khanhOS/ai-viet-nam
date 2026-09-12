// VLM review 4 screenshot Iron Forge
import ZAI from 'z-ai-web-dev-sdk';
import fs from 'fs';

const files = ['shot-hero.png', 'shot-programs.png', 'shot-stories.png', 'shot-mobile-hero.png'];
const zai = await ZAI.create();

for (const f of files) {
  const b64 = fs.readFileSync(`/home/z/my-project/scripts/fitness/${f}`).toString('base64');
  const res = await zai.chat.completions.createVision({
    model: 'glm-4.5v',
    messages: [{
      role: 'user',
      content: [
        { type: 'text', text: 'Đánh giá 5-7 câu về section website thương hiệu phòng tập cao cấp này (đen trắng + cam neon): bố cục, typography, ảnh, cảm giác chuyên nghiệp/hardcore, có lỗi hiển thị, ảnh méo/hỏng, chữ chồng nhau không?' },
        { type: 'image_url', image_url: { url: `data:image/png;base64,${b64}` } },
      ],
    }],
  });
  console.log(`══ ${f}\n${res.choices[0]?.message?.content?.trim()}\n`);
}
