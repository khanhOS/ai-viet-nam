import ZAI from 'z-ai-web-dev-sdk';
import fs from 'fs';
const DIR = '/home/z/my-project/public/fitness/img';
const files = process.argv.slice(2);
const zai = await ZAI.create();
for (const f of files) {
  const b64 = fs.readFileSync(`${DIR}/${f}`).toString('base64');
  const mime = f.endsWith('.png') ? 'image/png' : 'image/jpeg';
  try {
    const res = await zai.chat.completions.createVision({
      model: 'glm-4.5v',
      messages: [{ role: 'user', content: [
        { type: 'text', text: 'Trả lời gọn: [WATERMARK: có/không] [B&W: có/không] [NỘI DUNG: 5-10 từ] [NGƯỜI NỔI TIẾNG: không/tên] [CHẤT LƯỢNG: tốt/tb/kém]. WATERMARK = chữ/logo stock đè ảnh.' },
        { type: 'image_url', image_url: { url: `data:${mime};base64,${b64}` } },
      ]}],
    });
    console.log(`${f} → ${res.choices[0]?.message?.content?.trim()}`);
  } catch (e) { console.log(`${f} → LỖI: ${e.message}`); }
}
