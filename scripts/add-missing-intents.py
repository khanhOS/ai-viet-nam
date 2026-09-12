#!/usr/bin/env python3
# KhanhOS AI — Bổ sung 12 intent bị thiếu sau sự cố mất file (Task 12)
# Thêm: 10 intent local-AI/ML vào ai.json, oauth vào database-auth.json,
# vercel vào webdev-khanhos.json + responses + knowledge tương ứng.
# Idempotent: intent đã tồn tại thì bỏ qua.
import json, os

BASE = os.path.join(os.path.dirname(__file__), "..", "data", "chatbot")

def load(rel):
    with open(os.path.join(BASE, rel), encoding="utf-8") as f:
        return json.load(f)

def save(rel, data):
    with open(os.path.join(BASE, rel), "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
        f.write("\n")

NEW_AI_INTENTS = [
    {
        "id": "what_is_machine_learning",
        "description": "Machine Learning là gì",
        "topic": "ai",
        "patterns": [
            "machine learning là gì", "machine learning la gi", "ml là gì", "ml la gi",
            "học máy là gì", "hoc may la gi", "what is machine learning",
            "giải thích machine learning", "machine learning là sao",
            "machine learning dùng để làm gì", "machine learning và ai khác gì"
        ],
        "keywords": ["machine learning", "học máy", "ml"],
        "aliases": ["machine learning", "học máy"],
        "examples": ["Machine learning là gì?", "ml la gi", "học máy là gì?"],
        "related_intents": ["what_is_ai", "what_is_neural_network", "how_ai_works"],
        "response_id": "what_is_machine_learning",
        "knowledge_ref": "machine_learning",
        "confidence_threshold": 0.5
    },
    {
        "id": "local_ai_without_api",
        "description": "Chạy AI không cần API ngoài",
        "topic": "local_ai",
        "patterns": [
            "chạy ai không cần api", "chay ai khong can api",
            "local ai có cần api không", "local ai co can api khong",
            "ai local có cần api không", "chạy ai local có cần api không",
            "làm ai không cần api", "can ai run without api",
            "chạy ai không cần key", "ai offline có cần api không",
            "chạy ai có cần internet không"
        ],
        "keywords": ["không cần api", "local ai", "api"],
        "aliases": ["no api", "không api"],
        "examples": ["Chạy AI không cần API được không?", "local AI có cần api ko"],
        "related_intents": ["what_is_local_ai", "local_ai_setup", "ollama"],
        "response_id": "local_ai_without_api",
        "knowledge_ref": "local_ai",
        "confidence_threshold": 0.5
    },
    {
        "id": "local_ai_setup",
        "description": "Cách chạy AI trên máy mình",
        "topic": "local_ai",
        "patterns": [
            "cách chạy ai local", "cach chay ai local", "làm sao chạy ai local",
            "lam sao chay ai local", "setup ai local", "how to run local ai",
            "cài ai trên máy", "cai ai tren may", "hướng dẫn chạy ai local",
            "chạy ai trên máy tính", "chay ai tren may tinh"
        ],
        "keywords": ["chạy ai local", "setup ai", "local ai"],
        "aliases": ["local ai setup"],
        "examples": ["Làm sao chạy AI local?", "setup ai local như thế nào?"],
        "related_intents": ["what_is_local_ai", "ollama", "ram_requirements", "llama_cpp"],
        "response_id": "local_ai_setup",
        "knowledge_ref": "local_ai",
        "confidence_threshold": 0.5
    },
    {
        "id": "ram_requirements",
        "description": "Chạy AI local cần bao nhiêu RAM",
        "topic": "local_ai",
        "patterns": [
            "chạy ai cần ram bao nhiêu", "chay ai can ram bao nhieu",
            "llm ram requirements", "máy 8gb chạy ai được không", "may 8gb chay ai duoc khong",
            "chạy llm cần bao nhiêu ram", "ram for llm", "máy yếu chạy ai được không",
            "chạy ai cần cấu hình gì", "chay ai can ram"
        ],
        "keywords": ["ram", "cấu hình", "8gb"],
        "aliases": ["ram requirements"],
        "examples": ["Chạy AI cần RAM bao nhiêu?", "máy 8gb chạy AI được không?"],
        "related_intents": ["local_ai_setup", "ollama", "quantization", "gpu_inference"],
        "response_id": "ram_requirements",
        "knowledge_ref": "local_ai",
        "confidence_threshold": 0.5
    },
    {
        "id": "ollama",
        "description": "Ollama là gì",
        "topic": "local_ai",
        "patterns": [
            "ollama là gì", "ollama la gi", "what is ollama",
            "ollama dùng để làm gì", "ollama dung de lam gi",
            "cài ollama", "cai ollama", "ollama chạy thế nào",
            "giải thích ollama", "ollama là sao"
        ],
        "keywords": ["ollama"],
        "aliases": ["ollama"],
        "examples": ["Ollama là gì?", "ollama la gi", "cài Ollama thế nào?"],
        "related_intents": ["what_is_local_ai", "llama_cpp", "local_ai_setup"],
        "response_id": "ollama",
        "knowledge_ref": "ollama",
        "confidence_threshold": 0.5
    },
    {
        "id": "llama_cpp",
        "description": "llama.cpp là gì",
        "topic": "local_ai",
        "patterns": [
            "llama.cpp là gì", "llama cpp la gi", "llama cpp là gì",
            "what is llama.cpp", "what is llama cpp",
            "llama.cpp dùng để làm gì", "giải thích llama cpp", "llama.cpp là sao"
        ],
        "keywords": ["llama cpp", "llama.cpp"],
        "aliases": ["llama.cpp", "llama cpp"],
        "examples": ["llama.cpp là gì?", "what is llama.cpp"],
        "related_intents": ["ollama", "quantization", "local_ai_setup"],
        "response_id": "llama_cpp",
        "knowledge_ref": "llama_cpp",
        "confidence_threshold": 0.5
    },
    {
        "id": "local_model",
        "description": "Local model / model chạy trên máy",
        "topic": "local_ai",
        "patterns": [
            "local model là gì", "local model la gi", "mô hình local là gì",
            "what is a local model", "model chạy trên máy là gì", "chạy model local"
        ],
        "keywords": ["local model", "mô hình local"],
        "aliases": ["local model"],
        "examples": ["Local model là gì?"],
        "related_intents": ["what_is_local_ai", "ollama", "what_is_model"],
        "response_id": "local_model",
        "knowledge_ref": "local_ai",
        "confidence_threshold": 0.5
    },
    {
        "id": "quantization",
        "description": "Quantization (nén model) là gì",
        "topic": "local_ai",
        "patterns": [
            "quantization là gì", "quantization la gi", "lượng tử hoá model là gì",
            "what is quantization", "q4 q8 là gì", "gguf là gì", "gguf la gi",
            "model quantized là gì"
        ],
        "keywords": ["quantization", "gguf", "q4"],
        "aliases": ["quantization", "gguf"],
        "examples": ["Quantization là gì?", "gguf là gì?"],
        "related_intents": ["llama_cpp", "ram_requirements", "ollama"],
        "response_id": "quantization",
        "knowledge_ref": "quantization",
        "confidence_threshold": 0.5
    },
    {
        "id": "gpu_inference",
        "description": "Chạy AI bằng GPU / VRAM",
        "topic": "local_ai",
        "patterns": [
            "gpu inference là gì", "chạy llm bằng gpu", "chạy ai bằng gpu",
            "gpu dùng để chạy ai à", "inference trên gpu",
            "cpu hay gpu chạy ai tốt hơn", "vram cần bao nhiêu", "chạy ai bằng vram"
        ],
        "keywords": ["gpu", "vram", "inference"],
        "aliases": ["gpu inference"],
        "examples": ["Chạy LLM bằng GPU thế nào?", "CPU hay GPU chạy AI tốt hơn?"],
        "related_intents": ["ram_requirements", "quantization", "what_is_inference"],
        "response_id": "gpu_inference",
        "knowledge_ref": "local_ai",
        "confidence_threshold": 0.5
    },
    {
        "id": "local_ai_vs_api",
        "description": "Local AI vs gọi API — nên chọn gì",
        "topic": "local_ai",
        "patterns": [
            "local ai vs api", "local ai khác api thế nào",
            "chạy local hay dùng api", "local ai hay api tốt hơn",
            "local ai vs cloud ai", "nên chạy local hay gọi api"
        ],
        "keywords": ["local ai", "api"],
        "aliases": [],
        "examples": ["Local AI khác API thế nào?"],
        "related_intents": ["local_ai_without_api", "what_is_local_ai", "what_is_api"],
        "response_id": "local_ai_vs_api",
        "knowledge_ref": "local_ai",
        "confidence_threshold": 0.5
    }
]

NEW_OAUTH = {
    "id": "oauth",
    "description": "OAuth / đăng nhập bằng Google",
    "topic": "auth",
    "patterns": [
        "oauth là gì", "oauth la gi", "what is oauth", "oauth 2.0 là gì",
        "đăng nhập bằng google là gì", "oauth dùng để làm gì",
        "giải thích oauth", "social login là gì"
    ],
    "keywords": ["oauth", "social login"],
    "aliases": ["oauth"],
    "examples": ["OAuth là gì?", "đăng nhập bằng Google hoạt động thế nào?"],
    "related_intents": ["authentication", "jwt"],
    "response_id": "oauth",
    "knowledge_ref": "authentication",
    "confidence_threshold": 0.5
}

NEW_VERCEL = {
    "id": "vercel",
    "description": "Vercel — hosting cho Next.js",
    "topic": "webdev",
    "patterns": [
        "vercel là gì", "vercel la gi", "what is vercel",
        "deploy lên vercel", "vercel dùng để làm gì",
        "giải thích vercel", "hosting nextjs ở đâu"
    ],
    "keywords": ["vercel"],
    "aliases": ["vercel"],
    "examples": ["Vercel là gì?", "deploy Next.js lên đâu?"],
    "related_intents": ["hosting", "domain", "nextjs"],
    "response_id": "vercel",
    "knowledge_ref": "vercel",
    "confidence_threshold": 0.5
}

RESPONSES_AI = {
    "what_is_machine_learning": {
        "vi": [
            "Machine Learning (học máy) là nhánh AI mà máy tự học luật từ dữ liệu, thay vì được lập trình từng quy tắc. Cho nó đủ ví dụ, nó tự rút ra pattern — như người học nghề bằng cách làm nhiều lần.",
            "ML = học từ dữ liệu. Thay vì viết code 'nếu A thì B', bạn đưa hàng nghìn ví dụ A-B cho máy tự học cách suy ra. AI hiện đại phần lớn dựng trên nền này."
        ],
        "en": [
            "Machine Learning is the branch of AI where the system learns rules from data instead of being programmed rule by rule.",
            "ML = learning from examples: you feed it thousands of A→B cases and it figures the pattern out itself."
        ]
    },
    "local_ai_without_api": {
        "vi": [
            "Được — chạy AI local nghĩa là model chạy ngay trên máy bạn, không cần gọi API bên ngoài, không cần key, không tốn phí theo lượt. Đổi lại bạn cần RAM/VRAM đủ lớn và tốc độ tuỳ máy.",
            "Chạy local thì không cần API gì cả: tải model về (kiểu Ollama/llama.cpp), chạy trực tiếp trên CPU/GPU của bạn. Riêng tư hoàn toàn — dữ liệu không rời khỏi máy."
        ],
        "en": [
            "Yes — running AI locally means the model runs on your own machine: no external API, no key, no per-request fees.",
            "Local AI needs no API at all. Download a model (Ollama, llama.cpp) and run it on your own CPU/GPU."
        ]
    },
    "local_ai_setup": {
        "vi": [
            "Nhanh nhất: cài Ollama → chạy `ollama run llama3.2` (hoặc model nhỏ hơn máy yếu) → chat ngay trong terminal. Muốn giao diện web thì cài thêm Open WebUI. Máy càng nhiều RAM/VRAM, model càng to càng ngon.",
            "3 bước: (1) cài Ollama từ ollama.com, (2) gõ `ollama pull` model phù hợp RAM (máy 8GB lấy model 3-4B), (3) `ollama run <model>` để chat. Cần giao diện đẹp thì thêm Open WebUI."
        ],
        "en": [
            "Fastest path: install Ollama, run `ollama run llama3.2`, chat right in the terminal. More RAM/VRAM = bigger, better models.",
            "3 steps: install Ollama → pull a model that fits your RAM → run it. Add Open WebUI if you want a web interface."
        ]
    },
    "ram_requirements": {
        "vi": [
            "Ước lượng: model 7B ~ 8GB RAM (nén Q4), 13B ~ 16GB, 70B ~ 48GB+. Máy 8GB chạy được model 3B-7B dạng quantized là mượt. ít RAM hơn thì lấy model 1-3B.",
            "Nguyên tắc: RAM cần ≈ số tham số × 0.6-1 byte với model nén Q4. 8GB chạy 7B được, 16GB thoải mái 13B, còn 70B trở lên nên có GPU riêng."
        ],
        "en": [
            "Rule of thumb: a 7B quantized model needs ~8GB RAM, 13B ~16GB, 70B ~48GB+. An 8GB machine runs 3B–7B models well."
        ]
    },
    "ollama": {
        "vi": [
            "Ollama là công cụ chạy LLM local trên chính máy bạn — cài xong gõ `ollama run llama3.2` là chat được. Nó lo phần tải model, nén và chạy; bạn không cần API key hay internet sau khi tải.",
            "Ollama = trình quản lý model local: một lệnh tải model về, một lệnh chạy. Tự động chọn bản nén phù hợp, có API local để cắm vào app khác."
        ],
        "en": [
            "Ollama lets you run LLMs locally: one command downloads a model, another runs it. No API key, no cloud.",
            "Ollama is a local model manager — it handles downloading, quantizing and serving models on your machine."
        ]
    },
    "llama_cpp": {
        "vi": [
            "llama.cpp là engine chạy LLM bằng C++ thuần — nhẹ, chạy được cả trên CPU thường, không cần GPU. Là nền của rất nhiều tool local AI (Ollama cũng dựng trên nó).",
            "llama.cpp là 'lõi' chạy model local hiệu quả nhất: biên dịch C++, dùng định dạng GGUF, chạy tốt trên CPU, tốn ít RAM nhờ quantization."
        ],
        "en": [
            "llama.cpp is a pure C++ engine that runs LLMs efficiently — even on plain CPUs. It powers many local-AI tools including Ollama."
        ]
    },
    "local_model": {
        "vi": [
            "Local model là model AI chạy trên máy bạn (không gửi dữ liệu đi đâu). Ưu điểm: riêng tư, miễn phí sau khi tải, dùng offline. Nhược: chất lượng thường kém hơn model to trên cloud.",
            "Model local = file model tải về chạy trên máy mình. Bạn sở hữu hẳn nó — không quota, không phí, không ai đọc được nội dung chat."
        ],
        "en": [
            "A local model runs on your machine — private, free after download, works offline, though usually smaller than top cloud models."
        ]
    },
    "quantization": {
        "vi": [
            "Quantization là kỹ thuật nén model để tốn ít RAM hơn — ví dụ model 7B từ ~14GB xuống ~4GB (Q4) mà chất lượng giảm không đáng kể. Q4/Q8 là mức nén phổ biến: Q4 nhẹ nhất, Q8 gần nguyên bản.",
            "Quantization = giảm độ chính xác số học (FP16 → 4-bit/8-bit) để model nhẹ đi 3-4 lần. Đổi lại mất vài % chất lượng. Gần như bắt buộc nếu chạy model lớn trên máy thường."
        ],
        "en": [
            "Quantization compresses a model to use much less RAM (7B: ~14GB → ~4GB at Q4) with minimal quality loss. Q4 = smallest, Q8 = near-original."
        ]
    },
    "gpu_inference": {
        "vi": [
            "GPU tính toán song song rất mạnh nên chạy LLM nhanh hơn CPU nhiều lần — đặc biệt khi sinh token. VRAM càng nhiều thì càng chạy được model to. Nếu không có GPU dời, CPU vẫn chạy được với model nhỏ + quantization.",
            "Muốn nhanh thì chạy bằng GPU: cần VRAM ≥ kích thước model (Q4). 8GB VRAM chạy 7B là ngon. CPU chạy được nhưng chậm — chọn model nhỏ (1-3B) nếu chỉ có CPU."
        ],
        "en": [
            "GPUs massively parallelize LLM inference — much faster than CPU. You need VRAM ≥ model size (Q4): 8GB VRAM handles a 7B model nicely."
        ]
    },
    "local_ai_vs_api": {
        "vi": [
            "Local: riêng tư, miễn phí, offline — nhưng model nhỏ hơn, tốc độ tuỳ máy. API: model mạnh nhất, không cần phần cứng — nhưng tốn phí theo token và dữ liệu đi qua bên thứ ba. Chạy thử nội bộ/máy đủ mạnh → local; cần chất lượng tối đa → API.",
            "Gọn thế này: local thắng về riêng tư + chi phí dài hạn; API thắng về chất lượng model + không cần phần cứng. Nhiều người dùng cả hai — việc nhạy cảm cho local, việc khó cho API."
        ],
        "en": [
            "Local wins on privacy, cost-over-time and offline use; APIs win on model quality and zero hardware. Use both: sensitive stuff local, hard tasks via API."
        ]
    }
}

RESPONSES_OAUTH = {
    "oauth": {
        "vi": [
            "OAuth là bộ chuẩn cho phép app xin quyền truy cập tài khoản của bạn mà KHÔNG cần lấy mật khẩu — kiểu 'Đăng nhập bằng Google'. Bạn xác nhận trên trang Google, app chỉ nhận token quyền hạn chế.",
            "OAuth = đăng nhập ủy quyền: bấm 'Đăng nhập bằng Google/Facebook', bên đó xác nhận bạn là ai rồi cấp cho app một token giới hạn quyền. Mật khẩu của bạn không bao giờ đến tay app."
        ],
        "en": [
            "OAuth is the standard for granting an app limited access to your account without handing over your password — the 'Sign in with Google' flow."
        ]
    }
}

RESPONSES_VERCEL = {
    "vercel": {
        "vi": [
            "Vercel là nền tảng hosting sinh ra cho Next.js — push code lên Git là tự động build + deploy, có domain miễn phí và CDN toàn cầu. Trang KhanhOS này cũng theo hướng deploy kiểu đó.",
            "Vercel = deploy Next.js 1-cú-click: nối Git repo, nó tự build mỗi lần push, chạy trên edge toàn cầu. Free tier đủ dùng cho dự án nhỏ."
        ],
        "en": [
            "Vercel is the hosting platform built for Next.js: connect Git, it builds and deploys on every push, with global CDN and a free tier."
        ]
    }
}

KNOWLEDGE_AI_ADD = {
    "id": "machine_learning",
    "topic": "ai",
    "title": "Machine Learning — Học máy",
    "keywords": ["machine learning", "học máy", "ml"],
    "aliases": ["machine learning", "học máy"],
    "content": {
        "definition": "Machine Learning là nhánh AI mà hệ thống tự học quy luật từ dữ liệu thay vì được lập trình từng quy tắc thủ công.",
        "simple_explanation": "Thay vì viết 'nếu email có từ X thì là spam', bạn đưa hàng nghìn email đã gán nhãn cho máy tự học dấu hiệu spam.",
        "examples": ["Bộ lọc spam email", "Gợi ý video", "Dự đoán giá nhà", "Nhận diện ảnh"],
        "related_topics": ["AI", "Neural Network", "LLM"]
    },
    "related_intents": ["what_is_ai", "how_ai_works", "what_is_neural_network"]
}

KNOWLEDGE_WEB_ADD = {
    "id": "vercel",
    "topic": "webdev",
    "title": "Vercel — Hosting cho Next.js",
    "keywords": ["vercel", "deploy", "hosting nextjs"],
    "aliases": ["vercel"],
    "content": {
        "definition": "Vercel là nền tảng cloud xây bởi chính tác giả Next.js, tối ưu để deploy ứng dụng Next.js: nối Git, tự build, tự chạy CDN toàn cầu.",
        "simple_explanation": "Push code lên GitHub → Vercel tự build và đưa lên internet trong ~1 phút, kèm domain *.vercel.app miễn phí.",
        "examples": ["Deploy web tĩnh", "Deploy Next.js SSR/API routes", "Preview mỗi pull request"],
        "related_topics": ["Hosting", "Domain", "Deployment"]
    },
    "related_intents": ["hosting", "domain", "nextjs"]
}

def main():
    added = []

    # intents
    ai = load("intents/ai.json")
    have = {it["id"] for it in ai}
    for it in NEW_AI_INTENTS:
        if it["id"] not in have:
            ai.append(it); added.append("intents/ai.json:" + it["id"])
    save("intents/ai.json", ai)

    da = load("intents/database-auth.json")
    have = {it["id"] for it in da}
    if NEW_OAUTH["id"] not in have:
        da.append(NEW_OAUTH); added.append("intents/database-auth.json:oauth")
    save("intents/database-auth.json", da)

    wk = load("intents/webdev-khanhos.json")
    have = {it["id"] for it in wk}
    if NEW_VERCEL["id"] not in have:
        wk.append(NEW_VERCEL); added.append("intents/webdev-khanhos.json:vercel")
    save("intents/webdev-khanhos.json", wk)

    # responses
    ra = load("responses/ai.json")
    for k, v in RESPONSES_AI.items():
        if k not in ra:
            ra[k] = v; added.append("responses/ai.json:" + k)
    save("responses/ai.json", ra)

    rda = load("responses/database-auth.json")
    for k, v in RESPONSES_OAUTH.items():
        if k not in rda:
            rda[k] = v; added.append("responses/database-auth.json:" + k)
    save("responses/database-auth.json", rda)

    rwk = load("responses/webdev-khanhos.json")
    for k, v in RESPONSES_VERCEL.items():
        if k not in rwk:
            rwk[k] = v; added.append("responses/webdev-khanhos.json:" + k)
    save("responses/webdev-khanhos.json", rwk)

    # knowledge
    ka = load("knowledge/ai.json")
    if not any(k["id"] == "machine_learning" for k in ka):
        ka.append(KNOWLEDGE_AI_ADD); added.append("knowledge/ai.json:machine_learning")
    save("knowledge/ai.json", ka)

    kw = load("knowledge/web.json")
    if not any(k["id"] == "vercel" for k in kw):
        kw.append(KNOWLEDGE_WEB_ADD); added.append("knowledge/web.json:vercel")
    save("knowledge/web.json", kw)

    # verify
    total = 0
    import glob
    for f in glob.glob(os.path.join(BASE, "intents", "*.json")):
        total += len(json.load(open(f, encoding="utf-8")))
    resp_ids = set()
    for f in glob.glob(os.path.join(BASE, "responses", "*.json")):
        resp_ids.update(json.load(open(f, encoding="utf-8")).keys())
    missing_resp = []
    for f in glob.glob(os.path.join(BASE, "intents", "*.json")):
        for it in json.load(open(f, encoding="utf-8")):
            if it.get("response_id") and it["response_id"] not in resp_ids:
                missing_resp.append(it["id"])
    print("Added:", len(added))
    for a in added: print(" +", a)
    print("TOTAL intents:", total)
    print("Missing responses:", missing_resp if missing_resp else "none")

if __name__ == "__main__":
    main()
