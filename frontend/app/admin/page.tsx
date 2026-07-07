"use client";

import { FormEvent, useEffect, useState } from "react";
import { api } from "@/lib/api";

type DoctorItem = {
  id: number;
  name: string;
  cabin_number: string;
  status: "ACTIVE" | "INACTIVE" | string;
  created_at: string;
  live_queue_count: number;
  current_token: {
    id: number;
    token_number: string;
    called_at: string | null;
  } | null;
};

type AdminDashboardResponse = {
  stats: {
    total_doctors: number;
    active_doctors: number;
    today_tokens: number;
    waiting_tokens: number;
  };
  doctors: DoctorItem[];
};

export default function SuperAdminDashboardPage() {
  const [dashboard, setDashboard] = useState<AdminDashboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [deleteSubmittingId, setDeleteSubmittingId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [cabinNumber, setCabinNumber] = useState("");
  const [status, setStatus] = useState("ACTIVE");
  const [editingDoctorId, setEditingDoctorId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [editCabinNumber, setEditCabinNumber] = useState("");
  const [editStatus, setEditStatus] = useState("ACTIVE");

  useEffect(() => {
    void fetchDashboard();

    const poll = window.setInterval(() => {
      void fetchDashboard(false);
    }, 10000);

    return () => window.clearInterval(poll);
  }, []);

  async function fetchDashboard(showLoader = true) {
    try {
      if (showLoader) {
        setLoading(true);
      }

      const { data } = await api.get<AdminDashboardResponse>("/admin/dashboard");
      setDashboard(data);
      setError(null);
    } catch {
      setError("Unable to load super admin dashboard.");
    } finally {
      if (showLoader) {
        setLoading(false);
      }
    }
  }

  async function registerDoctor(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!name.trim() || !cabinNumber.trim()) {
      setError("Doctor name and cabin number are required.");
      return;
    }

    try {
      setSubmitting(true);
      setError(null);
      setSuccess(null);

      const { data } = await api.post<{ message: string }>("/admin/doctors", {
        name: name.trim(),
        cabin_number: cabinNumber.trim(),
        status,
      });

      setSuccess(data.message ?? "Doctor registered successfully.");
      setName("");
      setCabinNumber("");
      setStatus("ACTIVE");
      await fetchDashboard(false);
    } catch {
      setError("Doctor registration failed. Check cabin number uniqueness.");
    } finally {
      setSubmitting(false);
    }
  }

  function startEditDoctor(doctor: DoctorItem) {
    setEditingDoctorId(doctor.id);
    setEditName(doctor.name);
    setEditCabinNumber(doctor.cabin_number);
    setEditStatus(doctor.status === "INACTIVE" ? "INACTIVE" : "ACTIVE");
    setError(null);
    setSuccess(null);
  }

  function cancelEditDoctor() {
    setEditingDoctorId(null);
    setEditName("");
    setEditCabinNumber("");
    setEditStatus("ACTIVE");
  }

  async function saveDoctorEdit(doctorId: number) {
    if (!editName.trim() || !editCabinNumber.trim()) {
      setError("Doctor name and cabin number are required.");
      return;
    }

    try {
      setEditSubmitting(true);
      setError(null);
      setSuccess(null);

      const { data } = await api.put<{ message: string }>(`/admin/doctors/${doctorId}`, {
        name: editName.trim(),
        cabin_number: editCabinNumber.trim(),
        status: editStatus,
      });

      setSuccess(data.message ?? "Doctor updated successfully.");
      cancelEditDoctor();
      await fetchDashboard(false);
    } catch {
      setError("Doctor update failed. Check cabin number uniqueness.");
    } finally {
      setEditSubmitting(false);
    }
  }

  async function deleteDoctor(doctor: DoctorItem) {
    const confirmed = window.confirm(
      `Delete ${doctor.name} (${doctor.cabin_number})? This action cannot be undone.`
    );

    if (!confirmed) {
      return;
    }

    try {
      setDeleteSubmittingId(doctor.id);
      setError(null);
      setSuccess(null);

      const { data } = await api.delete<{ message: string }>(`/admin/doctors/${doctor.id}`);
      setSuccess(data.message ?? "Doctor deleted successfully.");

      if (editingDoctorId === doctor.id) {
        cancelEditDoctor();
      }

      await fetchDashboard(false);
    } catch {
      setError("Doctor delete failed. Ensure no waiting or calling tokens are assigned.");
    } finally {
      setDeleteSubmittingId(null);
    }
  }

  return (
    <main
      className="min-h-screen px-3 py-5 sm:px-6 sm:py-7 lg:px-8 lg:py-8"
      style={{ background: "radial-gradient(circle at top, #8EB69B 0%, #235347 52%, #051F20 100%)" }}
    >
      <div className="mx-auto w-full max-w-7xl space-y-6">
        <header className="rounded-3xl border border-[#8EB69B]/35 bg-[#0B2B26]/95 px-5 py-5 text-white shadow-2xl sm:px-7 sm:py-6">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#8EB69B]">Hospital Token System</p>
          <h1 className="mt-2 text-3xl font-black text-[#DAF1DE] sm:text-4xl">Super Admin Dashboard</h1>
          <p className="mt-2 text-[#DAF1DE]/90">Manage doctors and monitor live queue activity from one screen.</p>
        </header>

        {error ? <p className="rounded-xl border border-red-400/30 bg-red-900/20 px-4 py-3 font-semibold text-red-200">{error}</p> : null}
        {success ? <p className="rounded-xl bg-[#163832] px-4 py-3 font-semibold text-[#8EB69B]">{success}</p> : null}

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard title="Total Doctors" value={dashboard?.stats.total_doctors ?? 0} color="#0D6EFD" />
          <StatCard title="Active Doctors" value={dashboard?.stats.active_doctors ?? 0} color="#00A896" />
          <StatCard title="Today Tokens" value={dashboard?.stats.today_tokens ?? 0} color="#1F7A8C" />
          <StatCard title="Waiting Tokens" value={dashboard?.stats.waiting_tokens ?? 0} color="#F59E0B" />
        </section>

        <section className="grid gap-6 xl:grid-cols-[1.1fr,1.9fr]">
          <article className="rounded-3xl border border-[#8EB69B]/35 bg-[#0B2B26]/95 p-5 shadow-2xl sm:p-6">
            <h2 className="text-2xl font-black text-[#DAF1DE]">Register Doctor</h2>
            <p className="mt-1 text-sm text-[#8EB69B]">Create new doctor accounts and assign cabin numbers.</p>

            <form className="mt-5 space-y-4" onSubmit={registerDoctor}>
              <div>
                <label className="mb-1 block text-sm font-semibold text-[#8EB69B]" htmlFor="doctorName">
                  Doctor Name
                </label>
                <input
                  id="doctorName"
                  type="text"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  className="w-full rounded-xl border border-[#8EB69B]/35 bg-[#163832] px-4 py-3 text-base font-semibold text-[#DAF1DE] outline-none ring-[#8EB69B] transition focus:ring"
                  placeholder="Dr. John Smith"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-semibold text-[#8EB69B]" htmlFor="cabinNumber">
                  Cabin Number
                </label>
                <input
                  id="cabinNumber"
                  type="text"
                  value={cabinNumber}
                  onChange={(event) => setCabinNumber(event.target.value)}
                  className="w-full rounded-xl border border-[#8EB69B]/35 bg-[#163832] px-4 py-3 text-base font-semibold text-[#DAF1DE] outline-none ring-[#8EB69B] transition focus:ring"
                  placeholder="Cabin 01"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-semibold text-[#8EB69B]" htmlFor="doctorStatus">
                  Status
                </label>
                <select
                  id="doctorStatus"
                  value={status}
                  onChange={(event) => setStatus(event.target.value)}
                  className="w-full rounded-xl border border-[#8EB69B]/35 bg-[#163832] px-4 py-3 text-base font-semibold text-[#DAF1DE] outline-none ring-[#8EB69B] transition focus:ring"
                >
                  <option value="ACTIVE">ACTIVE</option>
                  <option value="INACTIVE">INACTIVE</option>
                </select>
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full rounded-2xl bg-[#235347] px-4 py-3 text-base font-black text-[#DAF1DE] transition hover:bg-[#163832] disabled:cursor-not-allowed disabled:opacity-70"
              >
                {submitting ? "REGISTERING..." : "REGISTER DOCTOR"}
              </button>
            </form>
          </article>

          <article className="rounded-3xl border border-[#8EB69B]/35 bg-[#0B2B26]/95 p-5 shadow-2xl sm:p-6">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-2xl font-black text-[#DAF1DE]">Doctor Directory</h2>
              <button
                type="button"
                onClick={() => void fetchDashboard()}
                className="rounded-xl border border-[#8EB69B] px-4 py-2 text-sm font-bold text-[#8EB69B] transition hover:bg-[#163832]"
              >
                Refresh
              </button>
            </div>

            {loading ? <p className="text-sm font-semibold text-[#8EB69B]">Loading doctors...</p> : null}

            <div className="space-y-3 md:hidden">
              {(dashboard?.doctors ?? []).map((doctor) => {
                const isEditing = editingDoctorId === doctor.id;

                return (
                  <div key={doctor.id} className="rounded-2xl border border-[#8EB69B]/30 bg-[#163832] p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        {isEditing ? (
                          <input
                            value={editName}
                            onChange={(event) => setEditName(event.target.value)}
                            className="w-full rounded-lg border border-[#8EB69B]/35 bg-[#0B2B26] px-3 py-2 text-sm font-semibold text-[#DAF1DE] outline-none ring-[#8EB69B] focus:ring"
                          />
                        ) : (
                          <p className="truncate text-base font-extrabold text-[#DAF1DE]">{doctor.name}</p>
                        )}
                        <p className="mt-1 text-xs font-semibold text-[#8EB69B]">Current Token: {doctor.current_token?.token_number ?? "---"}</p>
                        <p className="text-xs font-semibold text-[#8EB69B]">Waiting: {doctor.live_queue_count}</p>
                      </div>
                      {isEditing ? (
                        <select
                          value={editStatus}
                          onChange={(event) => setEditStatus(event.target.value)}
                          className="rounded-lg border border-[#8EB69B]/35 bg-[#0B2B26] px-2 py-2 text-xs font-bold text-[#DAF1DE] outline-none ring-[#8EB69B] focus:ring"
                        >
                          <option value="ACTIVE">ACTIVE</option>
                          <option value="INACTIVE">INACTIVE</option>
                        </select>
                      ) : (
                        <span
                          className={`inline-flex rounded-full px-3 py-1 text-xs font-bold ${
                            doctor.status === "ACTIVE" ? "bg-[#8EB69B] text-[#051F20]" : "bg-[#235347] text-[#DAF1DE]"
                          }`}
                        >
                          {doctor.status}
                        </span>
                      )}
                    </div>

                    <div className="mt-3">
                      <p className="mb-1 text-xs font-bold uppercase tracking-wide text-[#8EB69B]">Cabin</p>
                      {isEditing ? (
                        <input
                          value={editCabinNumber}
                          onChange={(event) => setEditCabinNumber(event.target.value)}
                          className="w-full rounded-lg border border-[#8EB69B]/35 bg-[#0B2B26] px-3 py-2 text-sm font-semibold text-[#DAF1DE] outline-none ring-[#8EB69B] focus:ring"
                        />
                      ) : (
                        <p className="text-sm font-bold text-[#DAF1DE]">{doctor.cabin_number}</p>
                      )}
                    </div>

                    <div className="mt-4 flex flex-wrap gap-2">
                      {isEditing ? (
                        <>
                          <button
                            type="button"
                            disabled={editSubmitting}
                            onClick={() => void saveDoctorEdit(doctor.id)}
                            className="rounded-lg bg-[#8EB69B] px-3 py-2 text-xs font-bold text-[#051F20] transition hover:bg-[#DAF1DE] disabled:opacity-60"
                          >
                            {editSubmitting ? "SAVING..." : "SAVE"}
                          </button>
                          <button
                            type="button"
                            disabled={editSubmitting}
                            onClick={cancelEditDoctor}
                            className="rounded-lg border border-[#8EB69B]/40 px-3 py-2 text-xs font-bold text-[#8EB69B] transition hover:bg-[#0B2B26] disabled:opacity-60"
                          >
                            CANCEL
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            type="button"
                            onClick={() => startEditDoctor(doctor)}
                            disabled={deleteSubmittingId === doctor.id}
                            className="rounded-lg border border-[#8EB69B] px-3 py-2 text-xs font-bold text-[#8EB69B] transition hover:bg-[#0B2B26] disabled:opacity-60"
                          >
                            EDIT
                          </button>
                          <button
                            type="button"
                            onClick={() => void deleteDoctor(doctor)}
                            disabled={deleteSubmittingId === doctor.id}
                            className="rounded-lg border border-red-400/50 px-3 py-2 text-xs font-bold text-red-300 transition hover:bg-red-900/20 disabled:opacity-60"
                          >
                            {deleteSubmittingId === doctor.id ? "DELETING..." : "DELETE"}
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}

              {(dashboard?.doctors ?? []).length === 0 && !loading ? (
                <div className="rounded-2xl border border-dashed border-[#8EB69B]/35 bg-[#163832] p-6 text-center text-sm font-semibold text-[#8EB69B]">
                  No doctors found. Register your first doctor.
                </div>
              ) : null}
            </div>

            <div className="hidden overflow-x-auto md:block">
              <table className="min-w-[860px] w-full text-left">
                <thead>
                  <tr className="border-b border-[#8EB69B]/30 text-xs font-bold uppercase tracking-wide text-[#8EB69B]">
                    <th className="py-3 pr-4">Doctor</th>
                    <th className="py-3 pr-4">Cabin</th>
                    <th className="py-3 pr-4">Status</th>
                    <th className="py-3 pr-4 hidden md:table-cell">Current Token</th>
                    <th className="py-3 hidden md:table-cell">Waiting</th>
                    <th className="py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {(dashboard?.doctors ?? []).map((doctor) => {
                    const isEditing = editingDoctorId === doctor.id;

                    return (
                      <tr key={doctor.id} className="border-b border-[#8EB69B]/20 text-sm font-semibold text-[#DAF1DE] sm:text-base">
                        <td className="py-3 pr-4">
                          {isEditing ? (
                            <input
                              value={editName}
                              onChange={(event) => setEditName(event.target.value)}
                              className="w-full min-w-44 rounded-lg border border-[#8EB69B]/35 bg-[#163832] px-3 py-2 text-sm font-semibold text-[#DAF1DE] outline-none ring-[#8EB69B] focus:ring"
                            />
                          ) : (
                            doctor.name
                          )}
                        </td>
                        <td className="py-3 pr-4">
                          {isEditing ? (
                            <input
                              value={editCabinNumber}
                              onChange={(event) => setEditCabinNumber(event.target.value)}
                              className="w-full min-w-32 rounded-lg border border-[#8EB69B]/35 bg-[#163832] px-3 py-2 text-sm font-semibold text-[#DAF1DE] outline-none ring-[#8EB69B] focus:ring"
                            />
                          ) : (
                            doctor.cabin_number
                          )}
                        </td>
                        <td className="py-3 pr-4">
                          {isEditing ? (
                            <select
                              value={editStatus}
                              onChange={(event) => setEditStatus(event.target.value)}
                              className="w-full min-w-32 rounded-lg border border-[#8EB69B]/35 bg-[#163832] px-3 py-2 text-sm font-semibold text-[#DAF1DE] outline-none ring-[#8EB69B] focus:ring"
                            >
                              <option value="ACTIVE">ACTIVE</option>
                              <option value="INACTIVE">INACTIVE</option>
                            </select>
                          ) : (
                            <span
                              className={`inline-flex rounded-full px-3 py-1 text-xs font-bold ${
                                doctor.status === "ACTIVE" ? "bg-[#8EB69B] text-[#051F20]" : "bg-[#235347] text-[#DAF1DE]"
                              }`}
                            >
                              {doctor.status}
                            </span>
                          )}
                        </td>
                        <td className="py-3 pr-4 font-extrabold text-[#8EB69B] hidden md:table-cell">{doctor.current_token?.token_number ?? "---"}</td>
                        <td className="py-3 hidden md:table-cell">{doctor.live_queue_count}</td>
                        <td className="py-3 text-right">
                          {isEditing ? (
                            <div className="inline-flex gap-2">
                              <button
                                type="button"
                                disabled={editSubmitting}
                                onClick={() => void saveDoctorEdit(doctor.id)}
                                className="rounded-lg bg-[#8EB69B] px-3 py-2 text-xs font-bold text-[#051F20] transition hover:bg-[#DAF1DE] disabled:opacity-60"
                              >
                                {editSubmitting ? "SAVING..." : "SAVE"}
                              </button>
                              <button
                                type="button"
                                disabled={editSubmitting}
                                onClick={cancelEditDoctor}
                                className="rounded-lg border border-[#8EB69B]/40 px-3 py-2 text-xs font-bold text-[#8EB69B] transition hover:bg-[#163832] disabled:opacity-60"
                              >
                                CANCEL
                              </button>
                            </div>
                          ) : (
                            <div className="inline-flex gap-2">
                              <button
                                type="button"
                                onClick={() => startEditDoctor(doctor)}
                                disabled={deleteSubmittingId === doctor.id}
                                className="rounded-lg border border-[#8EB69B] px-3 py-2 text-xs font-bold text-[#8EB69B] transition hover:bg-[#163832] disabled:opacity-60"
                              >
                                EDIT
                              </button>
                              <button
                                type="button"
                                onClick={() => void deleteDoctor(doctor)}
                                disabled={deleteSubmittingId === doctor.id}
                                className="rounded-lg border border-red-400/50 px-3 py-2 text-xs font-bold text-red-300 transition hover:bg-red-900/20 disabled:opacity-60"
                              >
                                {deleteSubmittingId === doctor.id ? "DELETING..." : "DELETE"}
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                  {(dashboard?.doctors ?? []).length === 0 && !loading ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-base font-semibold text-[#8EB69B]">
                        No doctors found. Register your first doctor.
                      </td>
                    </tr>
                  ) : null}
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
