"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { api } from "@/lib/api";

type Doctor = {
  id: number;
  name: string;
  cabin_number: string;
  status: string;
};

type CurrentToken = {
  id: number;
  token_number: string;
  status: string;
  called_at: string | null;
};

type WaitingToken = {
  id: number;
  token_number: string;
  issue_time: string;
  waiting_duration_minutes: number;
  created_at: string;
};

type DashboardStats = {
  total_today: number;
  completed_today: number;
  waiting_now: number;
};

type RealtimeHint = {
  channel: string;
  events: string[];
};

type DashboardPayload = {
  doctor: Doctor;
  current_token: CurrentToken | null;
  waiting_tokens: WaitingToken[];
  stats: DashboardStats;
  realtime: RealtimeHint;
  server_time: string;
};

type DashboardResponse = {
  message?: string;
  dashboard: DashboardPayload;
};

type ActionType = "next" | "recall" | "skip";

const COLORS = {
  primary: "#235347",
  secondary: "#8EB69B",
  background: "#DAF1DE",
  surface: "#0B2B26",
  surfaceSoft: "#163832",
  textLight: "#DAF1DE",
};

export default function DoctorDashboardPage() {
  const params = useParams<{ id: string }>();
  const doctorId = useMemo(() => Number(params?.id), [params]);
  const isValidDoctorId = Number.isFinite(doctorId) && doctorId > 0;

  const [dashboard, setDashboard] = useState<DashboardPayload | null>(null);
  const [now, setNow] = useState<Date>(new Date());
  const [loading, setLoading] = useState<boolean>(isValidDoctorId);
  const [error, setError] = useState<string | null>(isValidDoctorId ? null : "Invalid doctor ID.");
  const [actionLoading, setActionLoading] = useState<ActionType | null>(null);
  const [flash, setFlash] = useState<string | null>(null);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!isValidDoctorId) {
      return;
    }

    void fetchDashboard(doctorId);
  }, [doctorId, isValidDoctorId]);

  async function fetchDashboard(id: number) {
    try {
      setLoading(true);
      setError(null);

      const { data } = await api.get<DashboardPayload>(`/doctor/${id}/dashboard`);
      setDashboard(data);
    } catch {
      setError("Unable to load dashboard data. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  function hydrateDashboard(response: DashboardResponse | DashboardPayload) {
    if ("dashboard" in response) {
      setDashboard(response.dashboard);
      if (response.message) {
        setFlash(response.message);
      }
      return;
    }

    setDashboard(response);
  }

  async function callNextPatient() {
    if (!dashboard || actionLoading) {
      return;
    }

    try {
      setActionLoading("next");
      setError(null);
      const { data } = await api.post<DashboardResponse>(`/doctor/${dashboard.doctor.id}/next-token`);
      hydrateDashboard(data);
    } catch {
      setError("Could not move to the next patient.");
    } finally {
      setActionLoading(null);
    }
  }

  async function recallCurrentToken() {
    if (!dashboard?.current_token || actionLoading) {
      return;
    }

    try {
      setActionLoading("recall");
      setError(null);
      const { data } = await api.post<DashboardResponse>(`/token/${dashboard.current_token.id}/recall`);
      hydrateDashboard(data);
    } catch {
      setError("Could not recall the current token.");
    } finally {
      setActionLoading(null);
    }
  }

  async function skipCurrentToken() {
    if (!dashboard?.current_token || actionLoading) {
      return;
    }

    try {
      setActionLoading("skip");
      setError(null);
      const { data } = await api.post<DashboardResponse>(`/token/${dashboard.current_token.id}/skip`);
      hydrateDashboard(data);
    } catch {
      setError("Could not skip the current token.");
    } finally {
      setActionLoading(null);
    }
  }

  const todayDate = now.toLocaleDateString("en-US", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  });

  const time = now.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

  if (loading) {
    return (
      <main
        className="min-h-screen grid place-items-center"
        style={{ background: "radial-gradient(circle at top, #8EB69B 0%, #235347 52%, #051F20 100%)" }}
      >
        <div className="text-center">
          <p className="text-xl font-semibold text-[#DAF1DE]">Loading doctor dashboard...</p>
        </div>
      </main>
    );
  }

  if (error && !dashboard) {
    return (
      <main
        className="min-h-screen grid place-items-center p-6"
        style={{ background: "radial-gradient(circle at top, #8EB69B 0%, #235347 52%, #051F20 100%)" }}
      >
        <div className="w-full max-w-xl rounded-3xl border border-[#8EB69B]/40 bg-[#163832] p-8 text-center shadow-2xl">
          <h1 className="text-2xl font-bold text-red-600">Dashboard Unavailable</h1>
          <p className="mt-3 text-[#DAF1DE]">{error}</p>
          <button
            type="button"
            className="mt-5 rounded-xl px-5 py-3 font-semibold text-white"
            style={{ backgroundColor: COLORS.primary }}
            onClick={() => {
              if (isValidDoctorId) {
                void fetchDashboard(doctorId);
              }
            }}
          >
            Retry
          </button>
        </div>
      </main>
    );
  }

  if (!dashboard) {
    return null;
  }

  return (
    <main
      className="min-h-screen p-2 sm:p-4 lg:p-6"
      style={{ background: "radial-gradient(circle at top, #8EB69B 0%, #235347 52%, #051F20 100%)" }}
    >
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
        <header className="rounded-3xl border border-[#8EB69B]/35 bg-[#0B2B26]/95 p-5 shadow-2xl sm:p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-wider text-[#8EB69B]">Hospital Token System</p>
              <h1 className="mt-1 text-3xl font-black text-[#DAF1DE] sm:text-4xl">Base Hospital Kolonna</h1>
              <p className="mt-2 text-base text-[#DAF1DE]/90 sm:text-lg">Doctor Cabin Dashboard</p>
            </div>
            <div className="grid gap-2 rounded-2xl border border-[#8EB69B]/35 bg-[#163832] p-4 text-sm text-[#DAF1DE] sm:text-base lg:min-w-[320px]">
              <p>
                <span className="font-semibold text-[#8EB69B]">Doctor:</span>{" "}
                <span className="font-bold text-[#DAF1DE]">{dashboard.doctor.name}</span>
              </p>
              <p>
                <span className="font-semibold text-[#8EB69B]">Cabin:</span>{" "}
                <span className="font-bold text-[#DAF1DE]">{dashboard.doctor.cabin_number}</span>
              </p>
              <p>
                <span className="font-semibold text-[#8EB69B]">Date:</span> <span>{todayDate}</span>
              </p>
              <p>
                <span className="font-semibold text-[#8EB69B]">Time:</span>{" "}
                <span className="font-bold text-[#DAF1DE]">{time}</span>
              </p>
            </div>
          </div>
        </header>

        <section className="grid gap-6 lg:grid-cols-[1.7fr,1fr]">
          <article className="rounded-3xl border border-[#8EB69B]/35 bg-[#0B2B26]/95 p-6 shadow-2xl sm:p-8">
            <p className="text-center text-sm font-semibold uppercase tracking-[0.18em] text-[#8EB69B]">Now Serving</p>
            <div className="mt-4 text-center">
              <p className="text-[clamp(3rem,13vw,6.5rem)] font-black leading-none tracking-wide" style={{ color: COLORS.primary }}>
                {dashboard.current_token?.token_number ?? "---"}
              </p>
              <span className="mt-4 inline-flex rounded-full px-5 py-2 text-sm font-bold uppercase tracking-wide text-[#051F20]" style={{ backgroundColor: COLORS.secondary }}>
                {dashboard.current_token ? "Now Serving" : "No Active Token"}
              </span>
            </div>

            <div className="mt-7 grid gap-3 md:grid-cols-3">
              <button
                type="button"
                className="rounded-2xl px-4 py-5 text-base font-black text-white transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-60 sm:text-lg"
                style={{ backgroundColor: COLORS.primary, color: COLORS.textLight }}
                onClick={() => void callNextPatient()}
                disabled={actionLoading !== null}
              >
                {actionLoading === "next" ? "CALLING..." : "CALL NEXT PATIENT"}
              </button>
              <button
                type="button"
                className="rounded-2xl border px-4 py-5 text-base font-bold transition hover:bg-[#163832] disabled:cursor-not-allowed disabled:opacity-60 sm:text-lg"
                style={{ borderColor: COLORS.secondary, color: COLORS.secondary }}
                onClick={() => void recallCurrentToken()}
                disabled={!dashboard.current_token || actionLoading !== null}
              >
                {actionLoading === "recall" ? "RECALLING..." : "RECALL TOKEN"}
              </button>
              <button
                type="button"
                className="rounded-2xl border border-[#8EB69B] px-4 py-5 text-base font-bold text-[#8EB69B] transition hover:bg-[#163832] disabled:cursor-not-allowed disabled:opacity-60 sm:text-lg"
                onClick={() => void skipCurrentToken()}
                disabled={!dashboard.current_token || actionLoading !== null}
              >
                {actionLoading === "skip" ? "SKIPPING..." : "SKIP TOKEN"}
              </button>
            </div>

            {flash ? (
              <p className="mt-4 rounded-xl bg-[#163832] px-4 py-2 text-sm font-semibold text-[#8EB69B]">{flash}</p>
            ) : null}
            {error ? <p className="mt-3 text-sm font-semibold text-red-600">{error}</p> : null}
          </article>

          <aside className="grid gap-4 grid-cols-1 sm:grid-cols-3 lg:grid-cols-1">
            <StatCard title="Today Tokens" value={dashboard.stats.total_today} color={COLORS.primary} />
            <StatCard title="Completed" value={dashboard.stats.completed_today} color={COLORS.secondary} />
            <StatCard title="Waiting" value={dashboard.stats.waiting_now} color="#1F7A8C" />
          </aside>
        </section>

        <section className="rounded-3xl border border-[#8EB69B]/35 bg-[#0B2B26]/95 p-5 shadow-2xl sm:p-6">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-2xl font-extrabold text-[#DAF1DE]">Waiting Queue</h2>
            <p className="text-sm font-semibold text-[#8EB69B]">Doctor Assigned Tokens</p>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-[640px] w-full text-left">
              <thead>
                <tr className="border-b border-[#8EB69B]/30 text-sm uppercase tracking-wide text-[#8EB69B]">
                  <th className="py-3 pr-4">Token Number</th>
                  <th className="py-3 pr-4">Issue Time</th>
                  <th className="py-3">Waiting Duration</th>
                </tr>
              </thead>
              <tbody>
                {dashboard.waiting_tokens.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="py-8 text-center text-lg font-semibold text-[#8EB69B]">
                      No waiting tokens for this doctor.
                    </td>
                  </tr>
                ) : (
                  dashboard.waiting_tokens.map((token) => (
                    <tr key={token.id} className="border-b border-[#8EB69B]/20 text-base font-semibold text-[#DAF1DE] sm:text-lg">
                      <td className="py-4 pr-4 text-[#DAF1DE]">{token.token_number}</td>
                      <td className="py-4 pr-4">{token.issue_time}</td>
                      <td className="py-4">{token.waiting_duration_minutes} mins waiting</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </main>
  );
}

function StatCard({ title, value, color }: { title: string; value: number; color: string }) {
  return (
    <div className="rounded-2xl border border-[#8EB69B]/35 bg-[#163832] p-4 shadow-lg sm:p-5">
      <p className="text-sm font-bold uppercase tracking-wide text-[#8EB69B]">{title}</p>
      <p className="mt-2 text-4xl font-black" style={{ color }}>
        {value}
      </p>
    </div>
  );
}
