// Kiểm tra 15 ảnh fitness: watermark? nội dung gì? màu?
import ZAI from 'z-ai-web-dev-sdk';
import fs from 'fs';

const DIR = '/home/z/my-project/public/fitness/img';
const files = fs.readdirSync(DIR).filter((f) => /\.(jpe?g|png)$/i.test(f));

const zai = await ZAI.create();

for (const f of files) {
  const b64 = fs.readFileSync(`${DIR}/${f}`).toString('base64');
  const mime = f.endsWith('.png') ? 'image/png' : 'image/jpeg';
  try {
    const res = await zai.chat.completions.createVision({
      model: 'glm-4.5v',
      messages: [{
        role: 'user',
        content: [
          {
            type: 'text',
            text:
              'Trả lời gọn theo mẫu: [WATERMARK: có/không] [B&W: có/không] [NỘI DUNG: 5-10 từ] [CHẤT LƯỢNG: tốt/trung bình/kém]. ' +
              'WATERMARK = bất kỳ chữ/logo watermark stock (alamy, dreamstime, 123rf, stockcake...) hay chữ lớn đè lên ảnh. Ảnh chụp exercise/fitness/gym là nội dung tốt.',
          },
          { type: 'image_url', image_url: { url: `data:${mime};base64,${b64}` } },
        ],
      }],
    });
    console.log(`${f} → ${res.choices[0]?.message?.content?.trim()}`);
  } catch (e) {
    console.log(`${f} → LỖI VLM: ${e.message}`);
  }
}
