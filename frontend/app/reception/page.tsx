"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";

type ReceptionDashboard = {
  summary: {
    total_doctors: number;
    active_calls_count: number;
    total_waiting_count: number;
    today_tokens_count: number;
  };
  doctors: Array<{
    id: number;
    name: string;
    cabin_number: string;
    status: string;
    waiting_count: number;
    current_calling_token: {
      id: number;
      token_number: string;
      called_at: string | null;
    } | null;
    recent_tokens: Array<{
      id: number;
      token_number: string;
      status: string;
      created_at: string;
    }>;
  }>;
  server_time: string;
};

type TokenCreateResponse = {
  message: string;
  token: {
    id: number;
    token_number: string;
    doctor_id: number;
    doctor_name: string;
    cabin_number: string;
    status: string;
    created_at: string;
  };
  dashboard: ReceptionDashboard;
};

export default function ReceptionTokenCreatorPage() {
  const [dashboard, setDashboard] = useState<ReceptionDashboard | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const fetchDashboard = useCallback(async (showLoading = true) => {
    try {
      if (showLoading) {
        setLoading(true);
      }

      const { data } = await api.get<ReceptionDashboard>("/reception/dashboard");
      setDashboard(data);
      setError(null);
    } catch {
      setError("Unable to load reception dashboard.");
    } finally {
      if (showLoading) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void fetchDashboard();

    const refresh = window.setInterval(() => {
      void fetchDashboard(false);
    }, 8000);

    return () => window.clearInterval(refresh);
  }, [fetchDashboard]);

  async function createToken(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    try {
      setSubmitting(true);
      setError(null);
      setSuccess(null);

      const { data } = await api.post<TokenCreateResponse>("/reception/tokens");

      setDashboard(data.dashboard);
      setSuccess(
        `${data.message} New token: ${data.token.token_number} -> ${data.token.doctor_name} (${data.token.cabin_number})`
      );
    } catch {
      setError("Token creation failed. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main
      className="min-h-screen p-3 sm:p-5 lg:p-6"
      style={{ background: "radial-gradient(circle at top, #8EB69B 0%, #235347 52%, #051F20 100%)" }}
    >
      <div className="mx-auto w-full max-w-7xl space-y-6">
        <header className="rounded-3xl border border-[#8EB69B]/35 bg-[#0B2B26]/95 px-5 py-5 text-white shadow-2xl sm:px-7 sm:py-6">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#8EB69B]">Hospital Token System</p>
          <h1 className="mt-2 text-3xl font-black text-[#DAF1DE] sm:text-4xl">Reception Token Creator</h1>
          <p className="mt-2 text-[#DAF1DE]/90">Create patient tokens quickly with balanced doctor distribution and monitor active call counts in real time.</p>
        </header>

        {error ? <p className="rounded-xl border border-red-400/30 bg-red-900/20 px-4 py-3 text-sm font-semibold text-red-200">{error}</p> : null}
        {success ? <p className="rounded-xl bg-[#163832] px-4 py-3 text-sm font-semibold text-[#8EB69B]">{success}</p> : null}

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard title="Total Doctors" value={dashboard?.summary.total_doctors ?? 0} color="#0D6EFD" />
          <StatCard title="Active Calls" value={dashboard?.summary.active_calls_count ?? 0} color="#00A896" />
          <StatCard title="Total Waiting" value={dashboard?.summary.total_waiting_count ?? 0} color="#F59E0B" />
          <StatCard title="Today Tokens" value={dashboard?.summary.today_tokens_count ?? 0} color="#1F7A8C" />
        </section>

        <section className="grid gap-6 xl:grid-cols-[1.05fr,1.95fr]">
          <article className="rounded-3xl border border-[#8EB69B]/35 bg-[#0B2B26]/95 p-5 shadow-2xl sm:p-6">
            <h2 className="text-2xl font-black text-[#DAF1DE]">Create Token</h2>
            <p className="mt-1 text-sm text-[#8EB69B]">
              Doctor is assigned automatically with balanced distribution across doctors. Patient order remains FIFO by arrival time.
            </p>

            <form className="mt-5 space-y-4" onSubmit={createToken}>
              <div className="rounded-xl border border-dashed border-[#8EB69B]/35 bg-[#163832] px-4 py-3 text-sm font-semibold text-[#8EB69B]">
                Auto balanced assignment mode is enabled.
              </div>

              <button
                type="submit"
                disabled={submitting || (dashboard?.doctors.length ?? 0) === 0}
                className="w-full rounded-2xl bg-[#235347] px-4 py-4 text-base font-black text-[#DAF1DE] transition hover:bg-[#163832] disabled:cursor-not-allowed disabled:opacity-70"
              >
                {submitting ? "CREATING TOKEN..." : "CREATE TOKEN"}
              </button>
            </form>

            <p className="mt-4 text-xs font-semibold uppercase tracking-[0.12em] text-[#8EB69B]">
              Active calls count updates automatically after each token creation, and queue priority follows arrival order.
            </p>
          </article>

          <article className="rounded-3xl border border-[#8EB69B]/35 bg-[#0B2B26]/95 p-5 shadow-2xl sm:p-6">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-2xl font-black text-[#DAF1DE]">Doctor Queue Status</h2>
              <button
                type="button"
                onClick={() => void fetchDashboard()}
                className="rounded-xl border border-[#8EB69B] px-4 py-2 text-sm font-bold text-[#8EB69B] transition hover:bg-[#163832]"
              >
                Refresh
              </button>
            </div>

            {loading ? <p className="text-sm font-semibold text-[#8EB69B]">Loading queue status...</p> : null}

            <div className="space-y-3 md:hidden">
              {(dashboard?.doctors ?? []).map((doctor) => (
                <div key={doctor.id} className="rounded-2xl border border-[#8EB69B]/30 bg-[#163832] p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-base font-extrabold text-[#DAF1DE]">{doctor.name}</p>
                      <p className="mt-1 text-xs font-semibold text-[#8EB69B]">
                        {doctor.cabin_number} • {doctor.status}
                      </p>
                    </div>
                    <span className="rounded-full bg-[#235347] px-3 py-1 text-xs font-bold text-[#DAF1DE]">
                      Waiting {doctor.waiting_count}
                    </span>
                  </div>

                  <div className="mt-3 rounded-xl border border-[#8EB69B]/30 bg-[#0B2B26] px-3 py-2">
                    <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#8EB69B]">Now Calling</p>
                    <p className="mt-1 text-2xl font-black leading-none text-[#DAF1DE]">
                      {doctor.current_calling_token?.token_number ?? "---"}
                    </p>
                  </div>

                  <div className="mt-3">
                    <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#8EB69B]">Recent Tokens</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {doctor.recent_tokens.length === 0 ? (
                        <span className="text-xs text-[#8EB69B]">No tokens yet</span>
                      ) : (
                        doctor.recent_tokens.map((token) => (
                          <span key={token.id} className="rounded-lg bg-[#235347] px-2 py-1 text-xs font-extrabold text-[#DAF1DE]">
                            {token.token_number}
                          </span>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              ))}

              {(dashboard?.doctors ?? []).length === 0 && !loading ? (
                <div className="rounded-2xl border border-dashed border-[#8EB69B]/35 bg-[#163832] p-6 text-center text-sm font-semibold text-[#8EB69B]">
                  No doctors found.
                </div>
              ) : null}
            </div>

            <div className="hidden overflow-x-auto md:block">
              <table className="min-w-[820px] w-full text-left">
                <thead>
                  <tr className="border-b border-[#8EB69B]/30 text-xs font-bold uppercase tracking-wide text-[#8EB69B]">
                    <th className="py-3 pr-4">Doctor</th>
                    <th className="py-3 pr-4">Cabin</th>
                    <th className="py-3 pr-4">Now Calling</th>
                    <th className="py-3 pr-4">Waiting</th>
                    <th className="py-3 hidden md:table-cell">Recent Tokens</th>
                  </tr>
                </thead>
                <tbody>
                  {(dashboard?.doctors ?? []).map((doctor) => (
                    <tr key={doctor.id} className="border-b border-[#8EB69B]/20 align-top text-sm font-semibold text-[#DAF1DE] sm:text-base">
                      <td className="py-3 pr-4">
                        <p className="font-bold text-[#DAF1DE]">{doctor.name}</p>
                        <p className="mt-1 text-xs text-[#8EB69B]">{doctor.status}</p>
                      </td>
                      <td className="py-3 pr-4">{doctor.cabin_number}</td>
                      <td className="py-3 pr-4 font-extrabold text-[#8EB69B]">{doctor.current_calling_token?.token_number ?? "---"}</td>
                      <td className="py-3 pr-4">{doctor.waiting_count}</td>
                      <td className="py-3 hidden md:table-cell">
                        <div className="flex flex-wrap gap-2">
                          {doctor.recent_tokens.length === 0 ? (
                            <span className="text-xs text-[#8EB69B]">No tokens yet</span>
                          ) : (
                            doctor.recent_tokens.map((token) => (
                              <span key={token.id} className="rounded-lg bg-[#163832] px-2 py-1 text-xs font-extrabold text-[#DAF1DE] ring-1 ring-[#8EB69B]/25">
                                {token.token_number}
                              </span>
                            ))
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </article>
        </section>
      </div>
    </main>
  );
}

function StatCard({ title, value, color }: { title: string; value: number; color: string }) {
  return (
    <div className="rounded-2xl border border-[#8EB69B]/35 bg-[#163832] p-4 shadow-xl sm:p-5">
      <p className="text-sm font-bold uppercase tracking-wide text-[#8EB69B]">{title}</p>
      <p className="mt-2 text-4xl font-black" style={{ color }}>
        {value}
      </p>
    </div>
  );
}
