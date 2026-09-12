// Iron Forge — Curriculum: 3 chương trình sắp theo mục tiêu (tăng cơ / giảm mỡ / thể lực)

"use client";

import { Dumbbell, Flame, HeartPulse, Check, ArrowRight } from "lucide-react";
import { PROGRAMS } from "./fitness-data";
import { useSectionReveal } from "./fitness-hooks";

const GOAL_ICONS = { muscle: Dumbbell, fatloss: Flame, fitness: HeartPulse } as const;

export function FitnessCurriculum() {
  const sectionRef = useSectionReveal<HTMLElement>();

  return (
    <section id="fx-programs" ref={sectionRef} className="relative px-5 py-20 sm:px-8 sm:py-28">
      <div className="mx-auto max-w-6xl">
        {/* Header */}
        <p className="fx-reveal fx-kicker text-[11px] font-semibold text-[var(--fx-orange)]">
          01 — Chương trình
        </p>
        <h3 className="fx-reveal fx-heading mt-3 font-display text-4xl font-bold uppercase text-white sm:text-5xl">
          Chọn mục tiêu,
          <br />
          <span className="text-white/40">chúng tôi lo phần còn lại.</span>
        </h3>
        <p className="fx-reveal mt-4 max-w-xl text-[14px] leading-relaxed text-white/60">
          Mỗi lộ trình đều có cấu trúc giai đoạn, số liệu đo lường và HLV phụ trách
          riêng. Không bài tập bừa bãi — mọi buổi đều có lý do tồn tại của nó.
        </p>

        {/* Cards */}
        <div className="mt-10 grid gap-5 md:grid-cols-3">
          {PROGRAMS.map((p, i) => {
            const Icon = GOAL_ICONS[p.id as keyof typeof GOAL_ICONS];
            return (
              <article
                key={p.id}
                className="fx-reveal fx-card group relative flex flex-col overflow-hidden border border-[var(--fx-line)] bg-[var(--fx-panel)]"
                style={{ ["--fx-d" as string]: `${i * 110}ms` }}
              >
                {/* Ảnh */}
                <div className="relative h-52 overflow-hidden">
                  <img
                    src={p.image}
                    alt={p.title}
                    loading="lazy"
                    className="fx-photo h-full w-full object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-[var(--fx-panel)] via-transparent to-transparent" />
                  <span className="absolute left-4 top-4 flex h-9 w-9 items-center justify-center border border-[var(--fx-orange)]/50 bg-black/60 backdrop-blur-sm">
                    <Icon className="h-4.5 w-4.5 text-[var(--fx-orange)]" aria-hidden="true" />
                  </span>
                  <span className="fx-kicker absolute bottom-3 right-4 text-[10px] font-bold text-[var(--fx-orange)]">
                    {p.goal}
                  </span>
                </div>

                {/* Thân */}
                <div className="flex flex-1 flex-col p-5">
                  <div className="flex items-baseline justify-between gap-2">
                    <h4 className="font-display text-xl font-bold uppercase tracking-tight text-white">
                      {p.title}
                    </h4>
                    <span className="shrink-0 border border-white/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white/60">
                      {p.duration}
                    </span>
                  </div>
                  <p className="mt-1 text-[11px] font-semibold uppercase tracking-wide text-[var(--fx-silver)]/70">
                    {p.intensity}
                  </p>
                  <p className="mt-3 text-[13px] leading-relaxed text-white/65">{p.desc}</p>

                  {/* Chi tiết dày đặc */}
                  <dl className="mt-4 grid grid-cols-2 gap-px border border-[var(--fx-line)] bg-[var(--fx-line)]">
                    {p.details.map((d) => (
                      <div key={d.label} className="bg-[#101011] px-3 py-2.5">
                        <dt className="text-[9.5px] uppercase tracking-widest text-white/40">{d.label}</dt>
                        <dd className="mt-0.5 text-[12px] font-semibold text-white/85">{d.value}</dd>
                      </div>
                    ))}
                  </dl>

                  {/* Giai đoạn */}
                  <ul className="mt-4 space-y-1.5">
                    {p.phases.map((ph) => (
                      <li key={ph} className="flex items-start gap-2 text-[12px] text-white/60">
                        <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--fx-orange)]" aria-hidden="true" />
                        {ph}
                      </li>
                    ))}
                  </ul>

                  <div className="mt-auto flex items-center justify-between border-t border-[var(--fx-line)] pt-4">
                    <span className="font-display text-[15px] font-bold tabular-nums text-[var(--fx-orange)]">
                      {p.price}
                    </span>
                    <a
                      href="#fx-booking"
                      className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-widest text-white/50 transition-colors hover:text-[var(--fx-orange)]"
                      aria-label={`Đăng ký ${p.title}`}
                    >
                      Đăng ký
                      <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                    </a>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
