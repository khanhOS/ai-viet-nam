// KhanhOS AI — AI Studio modal: Tri thức (RAG) + Huấn luyện (LoRA) + Trí nhớ.
// Toàn bộ thao tác gọi route nội bộ (/api/knowledge, /api/training, /api/memory)
// → chạy trên model AI cục bộ. KHÔNG gọi API ngoài.
// Tab Huấn luyện chỉ chủ sở hữu thấy (server cũng chặn — UI chỉ ẩn cho gọn).

"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { useUIStore } from "@/store/use-ui-store";
import { useAuthStore } from "@/store/use-auth-store";
import { useToast } from "@/hooks/use-toast";
import { toast } from "@/hooks/use-toast";
import {
  BookOpen,
  Brain,
  Dumbbell,
  Trash2,
  Search,
  Upload,
  Download,
  Loader2,
  CheckCircle2,
  CircleOff,
  FileText,
  Database,
  Cpu,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ─────────────────────────────────────────────
// Types (khớp API responses)
// ─────────────────────────────────────────────

interface KnowledgeDoc {
  id: string;
  title: string;
  source: string | null;
  charCount: number;
  chunkCount: number;
  embeddingModel: string;
  createdAt: string;
}

interface SearchResult {
  documentId: string;
  documentTitle: string;
  chunkId: string;
  docIndex: number;
  content: string;
  score: number;
}

interface MemoryItem {
  id: string;
  kind: string;
  key: string;
  value: string;
  importance: number;
  updatedAt: string;
}

interface DatasetInfo {
  name: string;
  file: string;
  pairs: number;
  sizeBytes: number;
}

interface TrainingJobInfo {
  id: string;
  name: string;
  kind: string;
  baseModel: string;
  status: string;
  createdAt: string;
  result: { jobDir?: string; files?: string[] } | null;
}

interface TrainingData {
  runtime: {
    python: boolean;
    torch: boolean;
    cuda: boolean;
    canTrainHere: boolean;
    note: string;
  } | null;
  datasets: DatasetInfo[];
  jobs: TrainingJobInfo[];
  feedback: { up: number; down: number; total: number };
  trainingPairsAvailable: number;
  loraDefaults: {
    targetModules: string[];
    rank: number;
    alpha: number;
    epochs: number;
    learningRate: number;
    batchSize: number;
    maxSeqLength: number;
  } | null;
}

// ─────────────────────────────────────────────
// Modal
// ─────────────────────────────────────────────

export function AIStudioModal() {
  const open = useUIStore((s) => s.aiStudioOpen);
  const setOpen = useUIStore((s) => s.setAiStudioOpen);
  const user = useAuthStore((s) => s.user);
  const { toast } = useToast();

  const [tab, setTab] = useState("knowledge");

  // Knowledge state
  const [docs, setDocs] = useState<KnowledgeDoc[]>([]);
  const [embeddingReady, setEmbeddingReady] = useState<boolean | null>(null);
  const [embeddingModel, setEmbeddingModel] = useState<string>("");
  const [docTitle, setDocTitle] = useState("");
  const [docContent, setDocContent] = useState("");
  const [ingesting, setIngesting] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[] | null>(null);
  const [searching, setSearching] = useState(false);

  // Memory state
  const [memories, setMemories] = useState<MemoryItem[]>([]);

  // Training state
  const [training, setTraining] = useState<TrainingData | null>(null);
  const [exporting, setExporting] = useState(false);
  const [jobName, setJobName] = useState("astra-lora-1");
  const [baseModel, setBaseModel] = useState("Qwen/Qwen2.5-0.5B");
  const [adapter, setAdapter] = useState<"qlora" | "lora">("qlora");
  const [loraRank, setLoraRank] = useState(8);
  const [epochs, setEpochs] = useState(3);
  const [datasetName, setDatasetName] = useState("");

  const isOwner = user?.role === "owner";

  const loadKnowledge = useCallback(() => {
    fetch("/api/knowledge")
      .then((r) => r.json())
      .then((d) => {
        setDocs(d?.documents ?? []);
        setEmbeddingReady(d?.embedding?.available ?? null);
        setEmbeddingModel(d?.embedding?.model ?? "");
      })
      .catch(() => setDocs([]));
  }, []);

  const loadMemories = useCallback(() => {
    fetch("/api/memory?limit=100")
      .then((r) => r.json())
      .then((d) => setMemories(d?.memories ?? []))
      .catch(() => setMemories([]));
  }, []);

  const loadTraining = useCallback(() => {
    if (!isOwner) return;
    fetch("/api/training")
      .then((r) => r.json())
      .then((d) => setTraining(d ?? null))
      .catch(() => setTraining(null));
  }, [isOwner]);

  useEffect(() => {
    if (open && user) {
      loadKnowledge();
      loadMemories();
      if (isOwner) loadTraining();
    }
  }, [open, user, isOwner, loadKnowledge, loadMemories, loadTraining]);

  // ── Knowledge actions ──
  const ingest = async () => {
    if (!docTitle.trim() || !docContent.trim()) {
      toast({ title: "Thiếu tiêu đề hoặc nội dung", variant: "destructive" });
      return;
    }
    setIngesting(true);
    try {
      const res = await fetch("/api/knowledge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: docTitle, content: docContent }),
      });
      const d = await res.json();
      if (res.ok && d?.ok) {
        toast({
          title: "Đã nạp tài liệu",
          description: `${d.chunks} đoạn — nhúng thật bằng ${d.embeddingModel}. AI sẽ dùng tài liệu này khi trả lời.`,
        });
        setDocTitle("");
        setDocContent("");
        loadKnowledge();
      } else {
        toast({ title: "Không nạp được", description: d?.error ?? "Lỗi", variant: "destructive" });
      }
    } finally {
      setIngesting(false);
    }
  };

  const removeDoc = async (id: string) => {
    const res = await fetch(`/api/knowledge?id=${id}`, { method: "DELETE" });
    if (res.ok) {
      toast({ title: "Đã xoá tài liệu" });
      loadKnowledge();
    }
  };

  const runSearch = async () => {
    if (!searchQuery.trim()) return;
    setSearching(true);
    try {
      const res = await fetch("/api/knowledge/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: searchQuery, topK: 5 }),
      });
      const d = await res.json();
      if (res.ok) setSearchResults(d?.results ?? []);
      else setSearchResults([]);
    } finally {
      setSearching(false);
    }
  };

  // ── Memory actions ──
  const removeMemory = async (id: string) => {
    const res = await fetch(`/api/memory?id=${id}`, { method: "DELETE" });
    if (res.ok) {
      toast({ title: "Đã xoá khỏi trí nhớ" });
      loadMemories();
    }
  };

  // ── Training actions ──
  const exportDataset = async () => {
    setExporting(true);
    try {
      const res = await fetch("/api/training", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "export_dataset", name: datasetName || "khanhos-dataset", format: "alpaca" }),
      });
      const d = await res.json();
      if (res.ok && d?.ok) {
        toast({
          title: "Đã xuất dataset",
          description: `${d.pairs} mẫu huấn luyện → ${d.file}`,
        });
        setDatasetName("");
        loadTraining();
      } else {
        toast({ title: "Không xuất được dataset", description: d?.error ?? "Lỗi", variant: "destructive" });
      }
    } finally {
      setExporting(false);
    }
  };

  const createJob = async () => {
    if (!training?.datasets?.length) {
      toast({ title: "Chưa có dataset", description: "Xuất dataset từ phản hồi 👍 trước", variant: "destructive" });
      return;
    }
    const ds = training.datasets[training.datasets.length - 1];
    const res = await fetch("/api/training", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "create_job",
        name: jobName,
        config: {
          baseModel,
          adapter,
          rank: loraRank,
          alpha: loraRank * 2,
          dropout: 0.05,
          epochs,
          learningRate: 2e-4,
          batchSize: 4,
          maxSeqLength: 1024,
          quantBits: adapter === "qlora" ? 4 : 16,
          datasetFile: ds.file,
        },
      }),
    });
    const d = await res.json();
    if (res.ok && d?.ok) {
      toast({
        title: "Đã tạo job huấn luyện",
        description:
          d.status === "pending_runtime"
            ? "Server chưa có Python+torch — script huấn luyện đã sinh sẵn, chạy trên máy có GPU."
            : "Bộ script huấn luyện đã sẵn sàng.",
      });
      loadTraining();
    } else {
      toast({ title: "Không tạo được job", description: d?.error ?? "Lỗi", variant: "destructive" });
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="kh-glass-strong max-w-[560px] max-h-[85dvh] overflow-y-auto rounded-2xl border-foreground/10 p-0">
        <div className="px-6 pb-6 pt-5">
          <DialogHeader className="pb-4 text-left">
            <DialogTitle className="font-display flex items-center gap-2 text-lg font-semibold tracking-tight">
              <Brain className="h-5 w-5 text-primary" />
              AI Studio
            </DialogTitle>
            <DialogDescription className="text-[13px]">
              Tri thức riêng, trí nhớ và huấn luyện — chạy 100% trên model cục bộ.
            </DialogDescription>
          </DialogHeader>

          {!user ? (
            <div className="rounded-xl border border-foreground/10 bg-foreground/4 px-4 py-6 text-center text-sm text-muted-foreground">
              Đăng nhập để dùng AI Studio.
            </div>
          ) : (
            <Tabs value={tab} onValueChange={setTab}>
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="knowledge" className="text-xs">
                  <BookOpen className="mr-1 h-3.5 w-3.5" /> Tri thức
                </TabsTrigger>
                <TabsTrigger value="memory" className="text-xs">
                  <Brain className="mr-1 h-3.5 w-3.5" /> Trí nhớ
                </TabsTrigger>
                {isOwner && (
                  <TabsTrigger value="training" className="text-xs">
                    <Dumbbell className="mr-1 h-3.5 w-3.5" /> Huấn luyện
                  </TabsTrigger>
                )}
                {!isOwner && (
                  <TabsTrigger value="info" className="text-xs">
                    <Cpu className="mr-1 h-3.5 w-3.5" /> Hệ thống
                  </TabsTrigger>
                )}
              </TabsList>

              {/* ═══ TAB: TRI THỨC (RAG) ═══ */}
              <TabsContent value="knowledge" className="mt-4 space-y-4">
                {/* Trạng thái embedding */}
                <div className="flex items-center gap-2 rounded-xl border border-foreground/8 bg-foreground/4 px-3.5 py-2.5 text-xs">
                  {embeddingReady === null ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
                  ) : embeddingReady ? (
                    <>
                      <CheckCircle2 className="h-3.5 w-3.5 text-primary" />
                      <span className="text-foreground/80">
                        Model nhúng <span className="font-medium">{embeddingModel}</span> đang chạy —
                        tài liệu được nhúng thật (RAG).
                      </span>
                    </>
                  ) : (
                    <>
                      <CircleOff className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="text-muted-foreground">
                        Model nhúng chưa sẵn sàng — chạy <code className="rounded bg-foreground/8 px-1">ollama pull {embeddingModel || "nomic-embed-text"}</code> trên máy chủ.
                      </span>
                    </>
                  )}
                </div>

                {/* Nạp tài liệu */}
                <div className="space-y-2 rounded-xl border border-foreground/8 bg-foreground/4 p-4">
                  <div className="flex items-center gap-2 pb-1">
                    <Upload className="h-4 w-4 text-primary" />
                    <span className="text-sm font-medium">Nạp tài liệu vào tri thức</span>
                  </div>
                  <Input
                    placeholder="Tiêu đề tài liệu (vd: Tài liệu sản phẩm KhanhOS)"
                    value={docTitle}
                    onChange={(e) => setDocTitle(e.target.value)}
                    maxLength={200}
                  />
                  <Textarea
                    placeholder="Nội dung tài liệu (dán văn bản — sẽ được cắt đoạn và nhúng bằng model local)…"
                    value={docContent}
                    onChange={(e) => setDocContent(e.target.value)}
                    rows={5}
                    className="text-[13px]"
                  />
                  <Button onClick={ingest} disabled={ingesting} size="sm" className="w-full">
                    {ingesting ? (
                      <>
                        <Loader2 className="h-3.5 w-3.5 animate-spin" /> Đang nhúng tài liệu…
                      </>
                    ) : (
                      <>
                        <Upload className="h-3.5 w-3.5" /> Nạp &amp; nhúng
                      </>
                    )}
                  </Button>
                </div>

                {/* Danh sách tài liệu */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-muted-foreground">
                      Tài liệu của bạn ({docs.length})
                    </span>
                  </div>
                  {docs.length === 0 ? (
                    <p className="rounded-xl border border-dashed border-foreground/10 px-4 py-5 text-center text-xs text-muted-foreground">
                      Chưa có tài liệu. Nạp tài liệu để AI trích dẫn tri thức riêng của bạn khi trả lời.
                    </p>
                  ) : (
                    <div className="space-y-1.5">
                      {docs.map((doc) => (
                        <div
                          key={doc.id}
                          className="flex items-center justify-between gap-2 rounded-lg border border-foreground/8 bg-foreground/4 px-3 py-2"
                        >
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5">
                              <FileText className="h-3.5 w-3.5 shrink-0 text-primary/70" />
                              <span className="truncate text-[13px] font-medium">{doc.title}</span>
                            </div>
                            <p className="pt-0.5 text-[11px] text-muted-foreground">
                              {doc.chunkCount} đoạn · {(doc.charCount / 1000).toFixed(1)}k ký tự · nhúng {doc.embeddingModel}
                            </p>
                          </div>
                          <button
                            onClick={() => removeDoc(doc.id)}
                            aria-label="Xoá tài liệu"
                            className="shrink-0 rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-red-500/10 hover:text-red-400"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Thử truy vấn */}
                <div className="space-y-2 rounded-xl border border-foreground/8 bg-foreground/4 p-4">
                  <div className="flex items-center gap-2 pb-1">
                    <Search className="h-4 w-4 text-primary" />
                    <span className="text-sm font-medium">Thử truy vấn tri thức</span>
                  </div>
                  <div className="flex gap-2">
                    <Input
                      placeholder="Câu hỏi về tài liệu của bạn…"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && runSearch()}
                    />
                    <Button onClick={runSearch} disabled={searching} size="sm" variant="secondary">
                      {searching ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Search className="h-3.5 w-3.5" />}
                    </Button>
                  </div>
                  {searchResults !== null && (
                    <div className="space-y-1.5">
                      {searchResults.length === 0 ? (
                        <p className="text-xs text-muted-foreground">Không tìm thấy đoạn nào liên quan.</p>
                      ) : (
                        searchResults.map((r) => (
                          <div key={r.chunkId} className="rounded-lg border border-foreground/8 bg-background/40 px-3 py-2">
                            <p className="text-[11px] text-primary/80">
                              {r.documentTitle} · đoạn {r.docIndex + 1} · khớp {(r.score * 100).toFixed(0)}%
                            </p>
                            <p className="line-clamp-3 pt-0.5 text-xs text-muted-foreground">{r.content}</p>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>
              </TabsContent>

              {/* ═══ TAB: TRÍ NHỚ ═══ */}
              <TabsContent value="memory" className="mt-4 space-y-3">
                <p className="text-xs text-muted-foreground">
                  AI nhớ những gì bạn dặn rõ ràng (bắt đầu bằng “hãy ghi nhớ rằng…”). Đây là trí nhớ dài hạn —
                  xoá là mất ngay.
                </p>
                {memories.length === 0 ? (
                  <p className="rounded-xl border border-dashed border-foreground/10 px-4 py-5 text-center text-xs text-muted-foreground">
                    Chưa có trí nhớ dài hạn nào.
                  </p>
                ) : (
                  <div className="space-y-1.5">
                    {memories.map((m) => (
                      <div
                        key={m.id}
                        className="flex items-start justify-between gap-2 rounded-lg border border-foreground/8 bg-foreground/4 px-3 py-2"
                      >
                        <div className="min-w-0 flex-1">
                          <span className="rounded-full bg-primary/10 border border-primary/20 px-1.5 py-px text-[10px] text-primary">
                            {m.kind}
                          </span>
                          <p className="pt-1 text-xs text-foreground/85">{m.value}</p>
                          <p className="pt-0.5 text-[10px] text-muted-foreground/60">{m.key}</p>
                        </div>
                        <button
                          onClick={() => removeMemory(m.id)}
                          aria-label="Xoá trí nhớ"
                          className="shrink-0 rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-red-500/10 hover:text-red-400"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>

              {/* ═══ TAB: HUẤN LUYỆN (owner) ═══ */}
              <TabsContent value="training" className="mt-4 space-y-4">
                {/* Runtime trung thực */}
                <div className="rounded-xl border border-foreground/8 bg-foreground/4 p-3.5 text-xs">
                  <div className="flex items-center gap-2 pb-1">
                    <Cpu className="h-4 w-4 text-primary" />
                    <span className="font-medium">Runtime huấn luyện</span>
                  </div>
                  {training?.runtime ? (
                    <div className="space-y-1 pt-1">
                      <p className="flex items-center gap-1.5">
                        {training.runtime.canTrainHere ? (
                          <CheckCircle2 className="h-3.5 w-3.5 text-primary" />
                        ) : (
                          <CircleOff className="h-3.5 w-3.5 text-muted-foreground" />
                        )}
                        Python: {training.runtime.python ? "có" : "không"} · torch:{" "}
                        {training.runtime.torch ? "có" : "không"} · GPU: {training.runtime.cuda ? "có" : "không"}
                      </p>
                      <p className="text-muted-foreground">{training.runtime.note}</p>
                    </div>
                  ) : (
                    <p className="pt-1 text-muted-foreground">Đang kiểm tra…</p>
                  )}
                </div>

                {/* Vòng lặp dữ liệu */}
                <div className="rounded-xl border border-foreground/8 bg-foreground/4 p-4">
                  <div className="flex items-center gap-2 pb-1">
                    <Database className="h-4 w-4 text-primary" />
                    <span className="text-sm font-medium">Dữ liệu từ phản hồi</span>
                  </div>
                  <p className="pb-2.5 text-xs text-muted-foreground">
                    Chat và bấm 👍 cho câu trả lời tốt — mỗi lượt 👍 là một mẫu huấn luyện thật.
                  </p>
                  <div className="flex items-center gap-3 text-xs">
                    <span className="rounded-lg bg-primary/10 border border-primary/20 px-2 py-1 text-primary">
                      👍 {training?.feedback?.up ?? 0} mẫu tốt
                    </span>
                    <span className="rounded-lg bg-foreground/6 border border-foreground/10 px-2 py-1 text-muted-foreground">
                      👎 {training?.feedback?.down ?? 0}
                    </span>
                  </div>
                  <div className="mt-3 flex gap-2">
                    <Input
                      placeholder="Tên dataset (vd: khanhos-v1)"
                      value={datasetName}
                      onChange={(e) => setDatasetName(e.target.value)}
                    />
                    <Button onClick={exportDataset} disabled={exporting} size="sm" variant="secondary">
                      {exporting ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <>
                          <Download className="h-3.5 w-3.5" /> Xuất JSONL
                        </>
                      )}
                    </Button>
                  </div>
                  {training?.datasets?.length ? (
                    <div className="mt-2 space-y-1">
                      {training.datasets.map((ds) => (
                        <div
                          key={ds.name}
                          className="flex items-center justify-between rounded-lg border border-foreground/8 bg-background/40 px-3 py-1.5 text-xs"
                        >
                          <span className="truncate font-mono text-[11px]">{ds.file}</span>
                          <span className="shrink-0 text-muted-foreground">
                            {ds.pairs} mẫu · {(ds.sizeBytes / 1024).toFixed(1)}KB
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>

                {/* Tạo job LoRA */}
                <div className="space-y-2.5 rounded-xl border border-foreground/8 bg-foreground/4 p-4">
                  <div className="flex items-center gap-2 pb-1">
                    <Dumbbell className="h-4 w-4 text-primary" />
                    <span className="text-sm font-medium">Tạo job LoRA / QLoRA</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="col-span-2">
                      <label className="text-[11px] text-muted-foreground">Model gốc (HuggingFace repo)</label>
                      <Input value={baseModel} onChange={(e) => setBaseModel(e.target.value)} className="mt-1 text-[13px]" />
                    </div>
                    <div>
                      <label className="text-[11px] text-muted-foreground">Kiểu adapter</label>
                      <div className="mt-1 grid grid-cols-2 gap-1">
                        {(["qlora", "lora"] as const).map((a) => (
                          <button
                            key={a}
                            onClick={() => setAdapter(a)}
                            className={cn(
                              "rounded-lg py-1.5 text-xs font-medium transition-all",
                              adapter === a
                                ? "border border-primary/30 bg-primary/10 text-primary"
                                : "border border-transparent text-muted-foreground hover:bg-foreground/5"
                            )}
                          >
                            {a.toUpperCase()}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <label className="text-[11px] text-muted-foreground">Rank (r)</label>
                      <Input
                        type="number"
                        min={4}
                        max={128}
                        value={loraRank}
                        onChange={(e) => setLoraRank(Number(e.target.value))}
                        className="mt-1 text-[13px]"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] text-muted-foreground">Epochs</label>
                      <Input
                        type="number"
                        min={1}
                        max={20}
                        value={epochs}
                        onChange={(e) => setEpochs(Number(e.target.value))}
                        className="mt-1 text-[13px]"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] text-muted-foreground">Tên job</label>
                      <Input value={jobName} onChange={(e) => setJobName(e.target.value)} className="mt-1 text-[13px]" />
                    </div>
                  </div>
                  <Button onClick={createJob} size="sm" className="w-full">
                    <Dumbbell className="h-3.5 w-3.5" /> Sinh bộ script huấn luyện
                  </Button>
                  <p className="text-[11px] leading-relaxed text-muted-foreground/70">
                    Job sinh script Python thật (transformers + peft + bitsandbytes) trong{" "}
                    <code className="rounded bg-foreground/8 px-1">data/ai/training/jobs/</code>. Chạy trên máy có
                    GPU để có adapter fine-tune thật — server không có runtime thì job ở trạng thái chờ (không fake).
                  </p>
                </div>

                {/* Jobs */}
                {training?.jobs?.length ? (
                  <div className="space-y-1.5">
                    <span className="text-xs font-medium text-muted-foreground">Job gần đây</span>
                    {training.jobs.map((j) => (
                      <div
                        key={j.id}
                        className="rounded-lg border border-foreground/8 bg-foreground/4 px-3 py-2 text-xs"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="truncate font-medium">{j.name}</span>
                          <span
                            className={cn(
                              "shrink-0 rounded-full px-2 py-px text-[10px]",
                              j.status === "done"
                                ? "bg-green-500/10 text-green-400 border border-green-500/20"
                                : j.status === "pending_runtime"
                                  ? "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                                  : "bg-foreground/6 text-muted-foreground border border-foreground/10"
                            )}
                          >
                            {j.status === "pending_runtime" ? "chờ runtime" : j.status}
                          </span>
                        </div>
                        <p className="pt-0.5 text-[11px] text-muted-foreground">
                          {j.kind.toUpperCase()} · {j.baseModel}
                          {j.result?.jobDir ? ` · ${j.result.jobDir}` : ""}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : null}
              </TabsContent>

              {/* ═══ TAB: HỆ THỐNG (user thường) ═══ */}
              <TabsContent value="info" className="mt-4">
                <div className="rounded-xl border border-foreground/8 bg-foreground/4 p-4 text-xs leading-relaxed text-muted-foreground">
                  <p className="pb-2 font-medium text-foreground">Hệ AI cục bộ KhanhOS</p>
                  <p>
                    Toàn bộ suy luận chạy trên model trong máy chủ của bạn — không gửi dữ liệu đi đâu.
                    Bạn có thể nạp tri thức riêng (tab Tri thức) và AI sẽ trích dẫn khi trả lời.
                  </p>
                  <p className="pt-2">
                    Đánh giá 👍/👎 dưới mỗi câu trả lời giúp AI tốt lên theo thời gian — phản hồi tốt được
                    góp vào dữ liệu huấn luyện.
                  </p>
                </div>
              </TabsContent>
            </Tabs>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
