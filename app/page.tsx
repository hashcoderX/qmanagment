"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useRef } from "react";

type CabinDisplayPayload = {
  hospital_name: string;
  cabins: Array<{
    doctor: {
      id: number;
      name: string;
      status: string;
    };
    cabin_number: string;
    current_token: {
      id: number;
      token_number: string;
      called_at: string | null;
    } | null;
    waiting_count: number;
    waiting_tokens: Array<{
      id: number;
      token_number: string;
    }>;
    stats: {
      total_today: number;
      completed_today: number;
    };
  }>;
  summary: {
    total_cabins: number;
    active_calls: number;
    total_waiting: number;
  };
  server_time: string;
};

const REFRESH_INTERVAL_MS = 5000;

export default function MainPatientDisplayPage() {
  const [display, setDisplay] = useState<CabinDisplayPayload | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [clock, setClock] = useState<Date | null>(null);
  const firstLoadRef = useRef(true);

  useEffect(() => {
    const init = window.setTimeout(() => setClock(new Date()), 0);
    const timer = window.setInterval(() => setClock(new Date()), 1000);
    return () => {
      window.clearTimeout(init);
      window.clearInterval(timer);
    };
  }, []);

  const displayDate = clock
    ? clock.toLocaleDateString("en-US", { day: "2-digit", month: "long", year: "numeric" })
    : "-- -- ----";
  const displayTime = clock ? clock.toLocaleTimeString("en-US") : "--:--:--";

  useEffect(() => {
    let active = true;

    const loadCabinDisplay = async () => {
      try {
        if (firstLoadRef.current) {
          setLoading(true);
        }

        const { data } = await api.get<CabinDisplayPayload>("/display/cabins");

        if (!active) {
          return;
        }

        setDisplay(data);
        setError(null);
        firstLoadRef.current = false;
      } catch {
        if (!active) {
          return;
        }

        setError("Unable to load cabin display data.");
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    void loadCabinDisplay();
    const refresh = window.setInterval(() => {
      void loadCabinDisplay();
    }, REFRESH_INTERVAL_MS);

    return () => {
      active = false;
      window.clearInterval(refresh);
    };
  }, []);

  return (
    <main
      className="min-h-screen p-2 sm:p-4 lg:p-5"
      style={{ background: "radial-gradient(circle at top, #8EB69B 0%, #235347 52%, #051F20 100%)" }}
    >
      <div className="mx-auto flex min-h-[calc(100vh-1rem)] w-full max-w-[1800px] flex-col gap-3 rounded-3xl border border-[#8EB69B]/35 bg-[#0B2B26]/95 p-3 shadow-2xl sm:min-h-[calc(100vh-2rem)] sm:gap-4 sm:p-5 lg:p-6">
        <header className="rounded-3xl border border-[#8EB69B]/35 bg-[#163832] px-4 py-4 text-center sm:px-6 sm:py-5">
          <p className="text-xl font-bold tracking-wide text-[#DAF1DE] sm:text-2xl lg:text-3xl">
            {displayDate}
          </p>
          <p className="mt-2 text-[clamp(2.25rem,8vw,5rem)] font-black tracking-tight text-[#8EB69B]">
            {displayTime}
          </p>
          <div className="mt-4 flex flex-wrap items-center justify-center gap-3 sm:gap-4">
            <span className="rounded-full bg-[#235347] px-5 py-2 text-base font-extrabold text-[#DAF1DE] sm:text-lg">
              Active Calls: {display?.summary.active_calls ?? 0}
            </span>
            <span className="rounded-full bg-[#8EB69B] px-5 py-2 text-base font-extrabold text-[#051F20] sm:text-lg">
              Total Waiting: {display?.summary.total_waiting ?? 0}
            </span>
          </div>
        </header>

        <section className="grid flex-1 auto-rows-fr gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {(display?.cabins ?? []).map((cabin) => (
            <article key={cabin.doctor.id} className="flex h-full flex-col rounded-2xl border border-[#8EB69B]/30 bg-[#163832] p-3 shadow-xl sm:p-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#8EB69B]">{cabin.cabin_number}</p>
                  <h2 className="mt-1 text-lg font-black text-[#DAF1DE] sm:text-xl lg:text-2xl">{cabin.doctor.name}</h2>
                </div>
                <span
                  className={`rounded-full px-3 py-1 text-xs font-bold ${
                    cabin.doctor.status === "ACTIVE" ? "bg-[#8EB69B] text-[#051F20]" : "bg-[#235347] text-[#DAF1DE]"
                  }`}
                >
                  {cabin.doctor.status}
                </span>
              </div>

              <p className="patient-highlight-chip mt-4 inline-flex w-fit rounded-full bg-[#235347] px-3 py-1 text-xs font-semibold uppercase tracking-[0.15em] text-[#DAF1DE]">
                Now Serving
              </p>
              <p className="patient-highlight-text token-shine mt-1 text-[clamp(2.5rem,7vw,4.5rem)] font-black leading-none tracking-[0.08em]">
                {cabin.current_token?.token_number ?? "---"}
              </p>

              <div className="mt-3 rounded-xl border border-[#8EB69B]/35 bg-[#235347] px-3 py-2">
                <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#8EB69B]">Next In Line</p>
                <p className="mt-1 text-[clamp(1.8rem,5vw,2.25rem)] font-black leading-none tracking-[0.06em] text-[#DAF1DE]">
                  {cabin.waiting_tokens[0]?.token_number ?? "---"}
                </p>
              </div>

              <div className="mt-4 flex flex-wrap gap-2 text-xs font-bold sm:text-sm">
                <span className="rounded-full bg-[#235347] px-3 py-1 text-[#DAF1DE]">Waiting {cabin.waiting_count}</span>
                <span className="rounded-full bg-[#8EB69B] px-3 py-1 text-[#051F20]">
                  Completed {cabin.stats.completed_today}
                </span>
                <span className="rounded-full bg-[#051F20] px-3 py-1 text-[#DAF1DE]">Today {cabin.stats.total_today}</span>
              </div>

              <div className="mt-4 rounded-xl bg-[#0B2B26] p-3 ring-1 ring-[#8EB69B]/30">
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#8EB69B]">Next Tokens</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {cabin.waiting_tokens.length === 0 ? (
                    <span className="text-sm font-semibold text-[#8EB69B]">No waiting tokens</span>
                  ) : (
                    cabin.waiting_tokens.map((token) => (
                      <span key={token.id} className="rounded-lg bg-[#163832] px-3 py-1 text-sm font-extrabold text-[#DAF1DE] ring-1 ring-[#8EB69B]/25">
                        {token.token_number}
                      </span>
                    ))
                  )}
                </div>
              </div>
            </article>
          ))}

          {(display?.cabins ?? []).length === 0 && !loading ? (
            <div className="sm:col-span-2 xl:col-span-3 2xl:col-span-4 rounded-2xl border border-dashed border-[#8EB69B]/40 bg-[#163832] p-8 text-center text-lg font-semibold text-[#8EB69B]">
              No cabins available. Add doctors from the super admin dashboard.
            </div>
          ) : null}
        </section>

        <section className="flex items-center justify-center pb-1">
          <div className="flex flex-wrap items-center justify-center gap-3 text-sm font-semibold text-[#8EB69B]">
            {loading ? <span className="text-[#DAF1DE]">Loading cabin board...</span> : null}
            {error ? <span className="text-red-600">{error}</span> : null}
            {!loading && !error ? <span>Auto refresh every {REFRESH_INTERVAL_MS / 1000} seconds</span> : null}
          </div>
        </section>
      </div>
    </main>
  );
}
