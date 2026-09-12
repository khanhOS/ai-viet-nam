// Iron Forge — Coaches: flip card 3D (hover desktop / tap mobile)
// Mặt trước: ảnh + tên + vai trò. Mặt sau: chứng chỉ + background + bài tập chữ ký.

"use client";

import { useState } from "react";
import { BadgeCheck, Repeat2, Quote } from "lucide-react";
import { COACHES } from "./fitness-data";
import { useSectionReveal } from "./fitness-hooks";

export function FitnessCoaches() {
  const sectionRef = useSectionReveal<HTMLElement>();
  const [flippedId, setFlippedId] = useState<string | null>(null);

  return (
    <section id="fx-coaches" ref={sectionRef} className="relative px-5 py-20 sm:px-8 sm:py-28">
      <div className="mx-auto max-w-6xl">
        <p className="fx-reveal fx-kicker text-[11px] font-semibold text-[var(--fx-orange)]">
          02 — Huấn luyện viên
        </p>
        <h3 className="fx-reveal fx-heading mt-3 font-display text-4xl font-bold uppercase text-white sm:text-5xl">
          Người kèm bạn
          <br />
          <span className="text-white/40">đã được kiểm chứng.</span>
        </h3>
        <p className="fx-reveal mt-4 max-w-xl text-[14px] leading-relaxed text-white/60">
          Toàn bộ HLV trưởng đều giữ chứng nhận quốc tế còn hiệu lực và tái thẩm định
          hằng năm. Lật thẻ để xem hồ sơ năng lực.
        </p>

        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {COACHES.map((c, i) => (
            <div
              key={c.id}
              className={`fx-reveal fx-flip ${flippedId === c.id ? "fx-flipped" : ""}`}
              style={{ ["--fx-d" as string]: `${i * 100}ms` }}
              role="button"
              tabIndex={0}
              aria-label={`Lật thẻ hồ sơ của ${c.name}`}
              onClick={() => setFlippedId((id) => (id === c.id ? null : c.id))}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  setFlippedId((id) => (id === c.id ? null : c.id));
                }
              }}
            >
              <div className="fx-flip-inner h-[430px] w-full">
                {/* ── Mặt trước ── */}
                <div className="fx-flip-face fx-card relative h-full w-full overflow-hidden border border-[var(--fx-line)] bg-[var(--fx-panel)]">
                  <div className="relative h-[300px] overflow-hidden">
                    <img
                      src={c.photo}
                      alt={c.name}
                      loading="lazy"
                      className="fx-photo h-full w-full object-cover"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-[var(--fx-panel)] via-transparent to-transparent" />
                    <span className="absolute right-3 top-3 border border-white/15 bg-black/55 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white/70 backdrop-blur-sm">
                      {c.years}
                    </span>
                  </div>
                  <div className="p-4">
                    <h4 className="font-display text-lg font-bold uppercase tracking-tight text-white">
                      {c.name}
                    </h4>
                    <p className="mt-0.5 text-[12px] font-semibold text-[var(--fx-orange)]">
                      {c.role}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {c.specialties.map((s) => (
                        <span
                          key={s}
                          className="border border-white/10 px-2 py-0.5 text-[10px] text-white/55"
                        >
                          {s}
                        </span>
                      ))}
                    </div>
                    <p className="mt-3.5 flex items-center gap-1.5 text-[10px] uppercase tracking-widest text-white/35">
                      <Repeat2 className="h-3.5 w-3.5" aria-hidden="true" />
                      Lật để xem chứng chỉ
                    </p>
                  </div>
                </div>

                {/* ── Mặt sau ── */}
                <div className="fx-flip-back fx-flip-face flex h-full w-full flex-col border border-[var(--fx-orange)]/40 bg-[#0c0c0d]">
                  <div className="relative h-24 shrink-0 overflow-hidden">
                    <img src={c.photo} alt="" className="fx-photo h-full w-full object-cover object-top" loading="lazy" />
                    <div className="absolute inset-0 bg-gradient-to-b from-transparent to-[#0c0c0d]" />
                  </div>
                  <div className="flex flex-1 flex-col overflow-y-auto p-4">
                    <h4 className="font-display text-[15px] font-bold uppercase text-white">{c.name}</h4>
                    <p className="mt-0.5 text-[11px] font-semibold text-[var(--fx-orange)]">{c.role}</p>

                    <p className="mt-2.5 text-[10px] font-bold uppercase tracking-widest text-white/40">
                      Chứng chỉ
                    </p>
                    <ul className="mt-1.5 space-y-1">
                      {c.certs.map((cert) => (
                        <li key={cert} className="flex items-start gap-1.5 text-[12px] font-semibold text-white/85">
                          <BadgeCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--fx-orange)]" aria-hidden="true" />
                          {cert}
                        </li>
                      ))}
                    </ul>

                    <p className="mt-3 text-[11.5px] leading-relaxed text-white/60">{c.background}</p>

                    <div className="mt-auto border-t border-[var(--fx-line)] pt-3">
                      <p className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest text-[var(--fx-orange)]">
                        <Quote className="h-3 w-3" aria-hidden="true" />
                        Bài tập chữ ký
                      </p>
                      <p className="mt-1 text-[11.5px] font-semibold leading-snug text-white/80">
                        {c.signature}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
