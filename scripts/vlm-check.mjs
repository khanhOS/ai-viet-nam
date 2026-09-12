import ZAI from 'z-ai-web-dev-sdk';
import fs from 'fs';

const img = fs.readFileSync('/home/z/my-project/scripts/shot-home.png').toString('base64');
const zai = await ZAI.create();
const res = await zai.chat.completions.createVision({
  model: 'glm-4.5v',
  messages: [{
    role: 'user',
    content: [
      { type: 'text', text: 'Đánh giá ngắn gọn (5-7 câu) về giao diện website AI này: bố cục, thẩm mỹ, các thành phần nhìn thấy được, có lỗi hiển thị gì không?' },
      { type: 'image_url', image_url: { url: `data:image/png;base64,${img}` } }
    ]
  }]
});
console.log(res.choices[0]?.message?.content);
