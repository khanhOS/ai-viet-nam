// KhanhOS AI — Knowledge Admin Modal (owner-only)
// Quản trị tri thức chatbot cục bộ ngay trong web:
// - Tổng quan: stats + warnings + hướng dẫn
// - Kiểm thử: gửi message test → xem intent/confidence/điểm từng candidate
// - Tệp dữ liệu: edit JSON trực tiếp từng file (validate + atomic write)
// Dữ liệu sống ở data/chatbot/ — tách khỏi code, sửa không cần restart server.

"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useUIStore } from "@/store/use-ui-store";
import { useAuthStore } from "@/store/use-auth-store";
import { useToast } from "@/hooks/use-toast";
import {
  Database, FlaskConical, FileJson, Loader2, Save, RefreshCw,
  TriangleAlert, ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface AdminStats {
  intents: number;
  responses: number;
  knowledge: number;
  faq: number;
  patterns: number;
}

interface AdminOverview {
  files: string[];
  stats: AdminStats;
  system: { name: string; version: string; default_threshold: number };
  warnings: string[];
  topics: Array<{ id: string; name: string }>;
}

interface TestResult {
  intent: string | null;
  confidence: number;
  language: string;
  text: string;
  suggestions: string[];
  candidates: Array<{ intent: string; score: number; confidence: number; reasons: string[] }>;
}

type Tab = "overview" | "test" | "files";

export function KnowledgeAdminModal() {
  const open = useUIStore((s) => s.adminModalOpen);
  const setOpen = useUIStore((s) => s.setAdminModalOpen);
  const user = useAuthStore((s) => s.user);
  const { toast } = useToast();

  const [tab, setTab] = useState<Tab>("overview");
  const [overview, setOverview] = useState<AdminOverview | null>(null);
  const [loading, setLoading] = useState(false);

  // Test tab
  const [testMessage, setTestMessage] = useState("");
  const [testResult, setTestResult] = useState<TestResult | null>(null);
  const [testing, setTesting] = useState(false);

  // Files tab
  const [files, setFiles] = useState<string[]>([]);
  const [selectedFile, setSelectedFile] = useState<string>("");
  const [fileContent, setFileContent] = useState("");
  const [fileDirty, setFileDirty] = useState(false);
  const [saving, setSaving] = useState(false);

  const isOwner = user?.role === "owner";

  const loadOverview = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/chatbot");
      if (!res.ok) throw new Error("load");
      const data = await res.json();
      setOverview(data);
      setFiles(data.files ?? []);
    } catch {
      toast({ title: "Không tải được dữ liệu tri thức", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    if (open && isOwner) {
      loadOverview();
    }
  }, [open, isOwner, loadOverview]);

  const openFile = async (path: string) => {
    setSelectedFile(path);
    setFileDirty(false);
    try {
      const fileRes = await fetch(`/api/admin/chatbot?file=${encodeURIComponent(path)}`);
      if (!fileRes.ok) throw new Error();
      const data = await fileRes.json();
      setFileContent(data.content ?? "");
    } catch {
      toast({ title: "Không đọc được file", variant: "destructive" });
    }
  };

  const saveFile = async () => {
    if (!selectedFile || !fileDirty) return;
    // Validate JSON client-side trước
    try {
      JSON.parse(fileContent);
    } catch (e) {
      toast({
        title: "JSON không hợp lệ — chưa lưu",
        description: (e as Error).message,
        variant: "destructive",
      });
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/admin/chatbot", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: selectedFile, content: fileContent }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "save");
      setFileDirty(false);
      toast({
        title: "Đã lưu ✓",
        description: data?.stats ? `${data.stats.intents} intent • ${data.stats.knowledge} knowledge • ${data.stats.patterns} mẫu câu` : "Engine đã nạp lại",
      });
      if (data?.warnings?.length) {
        toast({ title: `Có ${data.warnings.length} cảnh báo dữ liệu`, description: data.warnings[0], variant: "destructive" });
      }
      loadOverview();
    } catch (e) {
      toast({ title: "Lưu thất bại", description: (e as Error).message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const runTest = async () => {
    if (!testMessage.trim()) return;
    setTesting(true);
    setTestResult(null);
    try {
      const res = await fetch("/api/admin/chatbot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: testMessage }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "test");
      setTestResult(data);
    } catch (e) {
      toast({ title: "Test lỗi", description: (e as Error).message, variant: "destructive" });
    } finally {
      setTesting(false);
    }
  };

  if (!isOwner) return null;

  const TABS: Array<{ id: Tab; label: string; icon: typeof Database }> = [
    { id: "overview", label: "Tổng quan", icon: Database },
    { id: "test", label: "Kiểm thử", icon: FlaskConical },
    { id: "files", label: "Tệp dữ liệu", icon: FileJson },
  ];

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="kh-glass-strong max-h-[85vh] overflow-hidden p-0 sm:max-w-2xl">
        <DialogHeader className="border-b border-foreground/8 px-6 pb-4 pt-6">
          <DialogTitle className="font-display text-lg font-semibold tracking-tight">
            <span className="inline-flex items-center gap-2">
              <Database className="h-5 w-5 text-primary" />
              Quản trị tri thức
            </span>
          </DialogTitle>
          <DialogDescription className="text-[13px]">
            Kiến thức bot sống ở <code className="rounded bg-foreground/8 px-1">data/chatbot/</code> — sửa
            file là hiệu lực ngay, không cần restart.
          </DialogDescription>
        </DialogHeader>

        {/* Tabs */}
        <div className="flex gap-1 border-b border-foreground/8 px-4">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={cn(
                "flex items-center gap-2 border-b-2 px-3 py-2.5 text-[13px] font-medium transition-colors",
                tab === t.id
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              <t.icon className="h-3.5 w-3.5" />
              {t.label}
            </button>
          ))}
        </div>

        <div className="max-h-[55vh] overflow-y-auto p-5">
          {/* ── TAB: TỔNG QUAN ── */}
          {tab === "overview" && (
            <div className="space-y-4">
              {loading && (
                <div className="flex items-center justify-center gap-2 py-8 text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" /> Đang tải…
                </div>
              )}
              {overview && (
                <>
                  <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
                    <StatBox label="Intent" value={overview.stats.intents} />
                    <StatBox label="Mẫu câu" value={overview.stats.patterns} />
                    <StatBox label="Knowledge" value={overview.stats.knowledge} />
                    <StatBox label="FAQ" value={overview.stats.faq} />
                  </div>
                  <div className="rounded-xl border border-foreground/8 bg-foreground/4 p-3.5 text-[13px] leading-relaxed text-muted-foreground">
                    Engine: <b className="text-foreground">{overview.system.name}</b> v{overview.system.version} • ngưỡng tin cậy mặc định{" "}
                    <b className="text-foreground">{overview.system.default_threshold}</b> • chạy 100% cục bộ.
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {overview.topics.map((t) => (
                        <span key={t.id} className="rounded-full border border-foreground/10 bg-foreground/5 px-2 py-0.5 text-[11px]">
                          {t.name}
                        </span>
                      ))}
                    </div>
                  </div>
                  {overview.warnings.length > 0 ? (
                    <div className="rounded-xl border border-amber/30 bg-amber/8 p-3.5">
                      <p className="flex items-center gap-2 text-[13px] font-medium text-amber">
                        <TriangleAlert className="h-4 w-4" /> {overview.warnings.length} cảnh báo dữ liệu
                      </p>
                      <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
                        {overview.warnings.slice(0, 6).map((w, i) => (
                          <li key={i} className="font-mono">• {w}</li>
                        ))}
                      </ul>
                    </div>
                  ) : (
                    <p className="rounded-xl border border-emerald/25 bg-emerald/8 p-3.5 text-[13px] text-emerald">
                      ✓ Dữ liệu hợp lệ — không có cảnh báo.
                    </p>
                  )}
                  <p className="text-xs leading-relaxed text-muted-foreground">
                    Cách thêm kiến thức: mở tab <b>Tệp dữ liệu</b> → chọn file nhóm chủ đề (vd{" "}
                    <code>intents/ai.json</code>) → thêm intent mới theo mẫu có sẵn → Lưu. Bot dùng ngay không
                    restart. Định dạng chi tiết: <code>data/chatbot/README.md</code>.
                  </p>
                </>
              )}
            </div>
          )}

          {/* ── TAB: KIỂM THỬ ── */}
          {tab === "test" && (
            <div className="space-y-3">
              <div className="flex gap-2">
                <input
                  value={testMessage}
                  onChange={(e) => setTestMessage(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && runTest()}
                  placeholder='Thử: "hayx lamf theo" / "AI la gi" / "thế local AI?"…'
                  className="kh-glass flex-1 rounded-xl px-3.5 py-2.5 text-[14px] text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-1 focus:ring-primary/40"
                />
                <button
                  onClick={runTest}
                  disabled={testing || !testMessage.trim()}
                  className="flex items-center gap-1.5 rounded-xl bg-primary px-3.5 py-2.5 text-[13px] font-medium text-primary-foreground transition-all hover:brightness-110 disabled:opacity-50"
                >
                  {testing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FlaskConical className="h-3.5 w-3.5" />}
                  Test
                </button>
              </div>

              {testResult && (
                <div className="space-y-3">
                  <div className="rounded-xl border border-foreground/8 bg-foreground/4 p-3.5">
                    <div className="flex flex-wrap items-center gap-2 text-[13px]">
                      <span className="font-mono rounded-md bg-primary/12 px-2 py-0.5 text-primary">
                        {testResult.intent ?? "(fallback)"}
                      </span>
                      <span className="text-muted-foreground">
                        conf <b className="text-foreground">{testResult.confidence}</b> • {testResult.language}
                      </span>
                    </div>
                    <pre className="mt-3 max-h-52 overflow-y-auto whitespace-pre-wrap rounded-lg bg-foreground/6 p-3 font-sans text-[13px] leading-relaxed text-foreground/90">
                      {testResult.text}
                    </pre>
                  </div>
                  {testResult.candidates.length > 0 && (
                    <div className="rounded-xl border border-foreground/8 p-3.5">
                      <p className="mb-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground/70">
                        Top candidates (điểm chuẩn hoá /100)
                      </p>
                      <div className="space-y-1.5">
                        {testResult.candidates.map((c, i) => (
                          <div key={c.intent} className="flex items-center gap-2 text-xs">
                            <span className="w-5 text-right font-mono text-muted-foreground">{i + 1}.</span>
                            <span className="w-40 truncate font-mono">{c.intent}</span>
                            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-foreground/8">
                              <div
                                className={cn("h-full rounded-full", i === 0 ? "bg-primary" : "bg-foreground/25")}
                                style={{ width: `${Math.min(100, c.score)}%` }}
                              />
                            </div>
                            <span className="w-16 text-right font-mono text-muted-foreground">
                              {c.score.toFixed(0)}đ
                            </span>
                          </div>
                        ))}
                      </div>
                      <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
                        Lý do intent đầu: {testResult.candidates[0]?.reasons.join("; ") || "—"}
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ── TAB: TỆP DỮ LIỆU ── */}
          {tab === "files" && (
            <div className="space-y-3">
              <div className="flex flex-wrap gap-1.5">
                {files.map((f) => (
                  <button
                    key={f}
                    onClick={() => openFile(f)}
                    className={cn(
                      "flex items-center gap-1 rounded-lg border px-2.5 py-1.5 font-mono text-[11px] transition-colors",
                      selectedFile === f
                        ? "border-primary/40 bg-primary/12 text-primary"
                        : "border-foreground/10 bg-foreground/4 text-muted-foreground hover:text-foreground"
                    )}
                  >
                    <FileJson className="h-3 w-3" />
                    {f}
                    <ChevronRight className="h-2.5 w-2.5 opacity-40" />
                  </button>
                ))}
              </div>

              {selectedFile ? (
                <>
                  <div className="flex items-center justify-between">
                    <p className="font-mono text-xs text-muted-foreground">{selectedFile}</p>
                    <div className="flex gap-2">
                      <button
                        onClick={() => openFile(selectedFile)}
                        className="flex items-center gap-1 rounded-lg border border-foreground/12 px-2.5 py-1.5 text-[11px] text-muted-foreground hover:text-foreground"
                        title="Nạp lại từ đĩa"
                      >
                        <RefreshCw className="h-3 w-3" /> Nạp lại
                      </button>
                      <button
                        onClick={saveFile}
                        disabled={!fileDirty || saving}
                        className="flex items-center gap-1 rounded-lg bg-primary px-3 py-1.5 text-[11px] font-medium text-primary-foreground disabled:opacity-40"
                      >
                        {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
                        Lưu {fileDirty ? "(chưa lưu)" : ""}
                      </button>
                    </div>
                  </div>
                  <textarea
                    value={fileContent}
                    onChange={(e) => {
                      setFileContent(e.target.value);
                      setFileDirty(true);
                    }}
                    spellCheck={false}
                    className="kh-glass h-[46vh] w-full resize-none rounded-xl p-3.5 font-mono text-[12px] leading-relaxed text-foreground/90 focus:outline-none focus:ring-1 focus:ring-primary/40"
                  />
                  <p className="text-[11px] text-muted-foreground">
                    Lưu = validate JSON + schema tối thiểu → ghi atomic → engine nạp lại theo mtime. Lỗi JSON
                    sẽ bị chặn trước khi ghi.
                  </p>
                </>
              ) : (
                <p className="py-8 text-center text-[13px] text-muted-foreground">
                  Chọn một file dữ liệu để chỉnh sửa.
                </p>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function StatBox({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-foreground/8 bg-foreground/4 p-3 text-center">
      <p className="font-display text-xl font-semibold text-foreground">{value.toLocaleString("vi-VN")}</p>
      <p className="mt-0.5 text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
    </div>
  );
}
