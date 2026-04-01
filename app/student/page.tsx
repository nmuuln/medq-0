"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

interface Profile {
  id: string;
  email: string;
  role: string;
  first_name: string | null;
  last_name: string | null;
  grade: number | null;
  class_code: string | null;
}

interface Assignment {
  id: string;
  title: string;
  description: string | null;
  deadline: string | null;
  points: number;
  teacher_id: string;
  grade: number;
  created_at: string;
  teacher?: Profile;
}

interface Submission {
  id: string;
  assignment_id: string;
  student_id: string;
  text: string | null;
  submitted_at: string;
  score: number | null;
  graded_at: string | null;
}

interface Message {
  id: string;
  from_id: string;
  to_id: string | null;
  to_email: string | null;
  text: string;
  sent_at: string;
}

export default function StudentDashboard() {
  const [user, setUser] = useState<Profile | null>(null);
  const [activeTab, setActiveTab] = useState("dashboard");
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const supabase = createClient();

  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [mySubmissions, setMySubmissions] = useState<Submission[]>([]);
  const [submitTarget, setSubmitTarget] = useState<Assignment | null>(null);
  const [submitText, setSubmitText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");

  // Chat state
  const [teachers, setTeachers] = useState<Profile[]>([]);
  const [selectedTeacher, setSelectedTeacher] = useState<string | null>(null);
  const [teacherEmail, setTeacherEmail] = useState("");
  const [chatMessages, setChatMessages] = useState<Message[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatSending, setChatSending] = useState(false);
  const chatBottomRef = useRef<HTMLDivElement>(null);

  // Load user on mount
  useEffect(() => {
    async function loadUser() {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser) {
        router.push("/auth/login");
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", authUser.id)
        .single();

      if (!profile || profile.role !== "student") {
        router.push("/auth/login");
        return;
      }

      setUser(profile);
      setLoading(false);
    }
    loadUser();
  }, [router, supabase]);

  // Load assignments and submissions
  useEffect(() => {
    if (!user) return;

    async function loadData() {
      // Load assignments for student's grade
      const { data: assignmentsData } = await supabase
        .from("assignments")
        .select("*, teacher:profiles!teacher_id(*)")
        .eq("grade", user.grade)
        .order("deadline", { ascending: true });

      // Load student's submissions
      const { data: submissionsData } = await supabase
        .from("submissions")
        .select("*")
        .eq("student_id", user.id);

      // Load registered teachers (with @olula.edu.mn emails)
      const { data: teachersData } = await supabase
        .from("profiles")
        .select("*")
        .eq("role", "teacher");

      setAssignments(assignmentsData || []);
      setMySubmissions(submissionsData || []);
      setTeachers(teachersData || []);
    }

    loadData();
  }, [user, supabase]);

  // Load chat messages
  const loadChat = useCallback(async () => {
    if (!user || (!selectedTeacher && !teacherEmail)) return;

    const { data } = await supabase
      .from("messages")
      .select("*")
      .or(`from_id.eq.${user.id},to_id.eq.${user.id}`)
      .order("sent_at", { ascending: true });

    // Filter messages for the selected conversation
    const filtered = (data || []).filter(msg => {
      if (selectedTeacher) {
        return (msg.from_id === user.id && msg.to_id === selectedTeacher) ||
               (msg.from_id === selectedTeacher && msg.to_id === user.id);
      } else if (teacherEmail) {
        return (msg.from_id === user.id && msg.to_email === teacherEmail) ||
               (msg.to_id === user.id);
      }
      return false;
    });

    setChatMessages(filtered);
  }, [user, selectedTeacher, teacherEmail, supabase]);

  useEffect(() => {
    loadChat();
  }, [loadChat]);

  // Poll for new messages
  useEffect(() => {
    if (!user || activeTab !== "chat") return;
    const iv = setInterval(loadChat, 5000);
    return () => clearInterval(iv);
  }, [user, activeTab, loadChat]);

  // Scroll chat to bottom
  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

  async function logout() {
    await supabase.auth.signOut();
    router.push("/auth/login");
  }

  function getSubmission(aid: string) {
    return mySubmissions.find(s => s.assignment_id === aid) || null;
  }

  function isPast(deadline: string | null) {
    if (!deadline) return false;
    return new Date(deadline) < new Date();
  }

  function isUrgent(deadline: string | null) {
    if (!deadline) return false;
    const d = new Date(deadline).getTime() - new Date().getTime();
    return d > 0 && d < 24 * 3600 * 1000;
  }

  function fmtDate(dateStr: string | null) {
    if (!dateStr) return "";
    return new Date(dateStr).toLocaleDateString("mn-MN", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });
  }

  function relTime(dateStr: string | null) {
    if (!dateStr) return "";
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins} минутын өмнө`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours} цагийн өмнө`;
    return `${Math.floor(hours / 24)} өдрийн өмнө`;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!submitTarget || !user) return;
    if (!submitText.trim()) {
      setSubmitError("Хариулт оруулна уу");
      return;
    }
    setSubmitting(true);
    setSubmitError("");

    try {
      const { data, error } = await supabase
        .from("submissions")
        .insert({
          assignment_id: submitTarget.id,
          student_id: user.id,
          text: submitText
        })
        .select()
        .single();

      if (error) throw error;

      setMySubmissions(prev => [...prev, data]);
      setSubmitTarget(null);
      setSubmitText("");
    } catch (err: unknown) {
      if (err instanceof Error) {
        setSubmitError(err.message);
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSendChat(e: React.FormEvent) {
    e.preventDefault();
    if (!chatInput.trim() || !user) return;

    // Validate email if sending to unregistered teacher
    if (!selectedTeacher && teacherEmail) {
      if (!teacherEmail.endsWith("@olula.edu.mn")) {
        return;
      }
    }

    setChatSending(true);
    try {
      const { data, error } = await supabase
        .from("messages")
        .insert({
          from_id: user.id,
          to_id: selectedTeacher || null,
          to_email: selectedTeacher ? null : teacherEmail,
          text: chatInput
        })
        .select()
        .single();

      if (error) throw error;

      setChatMessages(prev => [...prev, data]);
      setChatInput("");
    } finally {
      setChatSending(false);
    }
  }

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#f8fafc" }}>
        <p className="text-gray-500">Ачааллаж байна...</p>
      </div>
    );
  }

  const displayName = user.last_name && user.first_name
    ? `${user.last_name} ${user.first_name}`
    : user.email.split("@")[0];
  const initials = user.last_name && user.first_name
    ? (user.last_name[0] + user.first_name[0]).toUpperCase()
    : user.email[0].toUpperCase();

  const activeAssignments = assignments.filter(a => !isPast(a.deadline));
  const pendingCount = activeAssignments.filter(a => !getSubmission(a.id)).length;
  const gradedSubs = mySubmissions.filter(s => s.score !== null);
  const avgScore = gradedSubs.length
    ? Math.round(gradedSubs.reduce((s, sub) => s + (sub.score || 0), 0) / gradedSubs.length)
    : null;

  const NAV = [
    { key: "dashboard", label: "Хяналтын самбар", badge: null,
      icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M3 13h8V3H3v10zm0 8h8v-6H3v6zm10 0h8V11h-8v10zm0-18v6h8V3h-8z"/></svg> },
    { key: "assignments", label: "Миний даалгавар", badge: pendingCount || null,
      icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M14 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6zm-1 7V3.5L18.5 9H13z"/></svg> },
    { key: "chat", label: "Багш руу мессеж", badge: null,
      icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/></svg> },
  ];

  return (
    <div style={{ display: "flex", height: "100vh", overflow: "hidden", background: "#f8fafc", color: "#111827" }}>
      {/* SIDEBAR */}
      <div style={{ width: 220, background: "linear-gradient(180deg,#06b6d4 0%,#0891b2 100%)", display: "flex", flexDirection: "column", flexShrink: 0 }}>
        <div style={{ padding: "22px 14px 14px", display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 40, height: 40, borderRadius: 12, background: "rgba(255,255,255,0.25)", display: "flex", alignItems: "center", justifyContent: "center", color: "white", fontWeight: 800, fontSize: 16, flexShrink: 0 }}>
            {initials}
          </div>
          <div style={{ minWidth: 0 }}>
            <p style={{ color: "white", fontWeight: 700, fontSize: 13, margin: 0 }}>Сурагчийн самбар</p>
            <p style={{ color: "rgba(255,255,255,0.65)", fontSize: 11, margin: 0 }}>{user.grade}-р анги</p>
          </div>
        </div>

        <nav style={{ flex: 1, padding: "6px 10px", display: "flex", flexDirection: "column", gap: 3 }}>
          {NAV.map(item => {
            const active = activeTab === item.key;
            return (
              <button key={item.key} onClick={() => setActiveTab(item.key)} style={{
                width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "10px 12px",
                borderRadius: 10, border: "none", cursor: "pointer", fontWeight: 600, fontSize: 13, textAlign: "left",
                background: active ? "white" : "transparent",
                color: active ? "#06b6d4" : "rgba(255,255,255,0.9)",
              }}>
                <span style={{ flexShrink: 0 }}>{item.icon}</span>
                <span style={{ flex: 1 }}>{item.label}</span>
                {item.badge != null && (
                  <span style={{
                    background: active ? "#06b6d4" : "rgba(255,255,255,0.25)",
                    color: "white", fontSize: 11, fontWeight: 700,
                    padding: "1px 7px", borderRadius: 99,
                  }}>{item.badge}</span>
                )}
              </button>
            );
          })}
        </nav>

        <div style={{ margin: "0 10px 16px", padding: "10px 12px", borderRadius: 10, background: "rgba(255,255,255,0.15)", display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: "rgba(255,255,255,0.3)", display: "flex", alignItems: "center", justifyContent: "center", color: "white", fontWeight: 800, fontSize: 12, flexShrink: 0 }}>
            {initials}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ color: "white", fontWeight: 700, fontSize: 12, margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{displayName}</p>
            <p style={{ color: "rgba(255,255,255,0.6)", fontSize: 10, margin: 0 }}>Сурагч</p>
          </div>
          <button onClick={logout} title="Гарах" style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(255,255,255,0.7)", padding: 4, display: "flex", alignItems: "center" }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M17 7l-1.41 1.41L18.17 11H8v2h10.17l-2.58 2.58L17 17l5-5zM4 5h8V3H4c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h8v-2H4V5z"/></svg>
          </button>
        </div>
      </div>

      {/* MAIN */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <div style={{ background: "white", padding: "16px 28px", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid #f1f5f9", flexShrink: 0 }}>
          <div>
            {activeTab === "dashboard" && (
              <>
                <h1 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: "#111827" }}>Сайн байна уу, {displayName}!</h1>
                <p style={{ margin: 0, fontSize: 13, color: "#9ca3af" }}>Өнөөдөр хичээлээ сайн явуулаарай</p>
              </>
            )}
            {activeTab === "assignments" && (
              <>
                <h1 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: "#111827" }}>Миний даалгаврууд</h1>
                <p style={{ margin: 0, fontSize: 13, color: "#9ca3af" }}>{assignments.length} даалгавар нийт</p>
              </>
            )}
            {activeTab === "chat" && (
              <>
                <h1 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: "#111827" }}>Багш руу мессеж</h1>
                <p style={{ margin: 0, fontSize: 13, color: "#9ca3af" }}>@olula.edu.mn багш нартай харилцах</p>
              </>
            )}
          </div>
        </div>

        <div style={{ flex: 1, overflow: "hidden" }}>
          {/* DASHBOARD TAB */}
          {activeTab === "dashboard" && (
            <div style={{ height: "100%", overflowY: "auto", padding: "24px 28px" }}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 16, marginBottom: 24 }}>
                {[
                  { label: "Нийт даалгавар", value: assignments.length, bg: "#e0f7fa",
                    icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="#06b6d4"><path d="M21 5c-1.11-.35-2.33-.5-3.5-.5-1.95 0-4.05.4-5.5 1.5-1.45-1.1-3.55-1.5-5.5-1.5S2.45 4.9 1 6v14.65c0 .25.25.5.5.5.1 0 .15-.05.25-.05C3.1 20.45 5.05 20 6.5 20c1.95 0 4.05.4 5.5 1.5 1.35-.85 3.8-1.5 5.5-1.5 1.65 0 3.35.3 4.75 1.05.1.05.15.05.25.05.25 0 .5-.25.5-.5V6c-.6-.45-1.25-.75-2-1z"/></svg> },
                  { label: "Хүлээгдэж буй", value: pendingCount, bg: "#fff3e0",
                    icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="#f97316"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67V7z"/></svg> },
                  { label: "Дууссан", value: mySubmissions.length, bg: "#e8fdf5",
                    icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="#10b981"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/></svg> },
                  { label: "Дундаж үнэлгээ", value: avgScore !== null ? `${avgScore}%` : "—", bg: "#fff3e0",
                    icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="#f97316"><path d="M16 6l2.29 2.29-4.88 4.88-4-4L2 16.59 3.41 18l6-6 4 4 6.3-6.29L22 12V6z"/></svg> },
                ].map((s, i) => (
                  <div key={i} style={{ background: "white", borderRadius: 14, padding: "16px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
                    <div>
                      <p style={{ margin: 0, fontSize: 12, color: "#9ca3af", marginBottom: 4 }}>{s.label}</p>
                      <p style={{ margin: 0, fontSize: 26, fontWeight: 900, color: "#111827" }}>{s.value}</p>
                    </div>
                    <div style={{ width: 44, height: 44, borderRadius: 12, background: s.bg, display: "flex", alignItems: "center", justifyContent: "center" }}>{s.icon}</div>
                  </div>
                ))}
              </div>

              {/* Upcoming assignments */}
              <div style={{ background: "white", borderRadius: 16, padding: 20, boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
                  <p style={{ margin: 0, fontWeight: 700, fontSize: 15, color: "#111827" }}>Удахгүй болох даалгавар</p>
                  <button onClick={() => setActiveTab("assignments")}
                    style={{ background: "none", border: "none", cursor: "pointer", fontSize: 13, color: "#06b6d4", fontWeight: 600 }}>
                    Бүгдийг үзэх
                  </button>
                </div>
                {activeAssignments.length === 0 ? (
                  <p style={{ textAlign: "center", color: "#d1d5db", fontSize: 13, padding: "20px 0", margin: 0 }}>Даалгавар байхгүй</p>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    {activeAssignments.slice(0, 4).map(a => {
                      const sub = getSubmission(a.id);
                      const urgent = isUrgent(a.deadline);
                      return (
                        <div key={a.id} style={{ borderLeft: "3px solid #06b6d4", paddingLeft: 14, paddingRight: 14, paddingTop: 10, paddingBottom: 10, borderRadius: "0 10px 10px 0", background: "#f8fafc", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3 }}>
                              <p style={{ margin: 0, fontWeight: 700, fontSize: 14, color: "#111827" }}>{a.title}</p>
                              {urgent && !sub && <span style={{ background: "#f97316", color: "white", fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 99, flexShrink: 0 }}>Яаралтай</span>}
                            </div>
                            <p style={{ margin: 0, color: "#9ca3af", fontSize: 12 }}>{fmtDate(a.deadline)}</p>
                          </div>
                          <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
                            <span style={{ fontSize: 13, fontWeight: 600, color: "#6b7280" }}>{a.points} оноо</span>
                            {sub ? (
                              <span style={{ background: "#dcfce7", color: "#16a34a", fontSize: 11, fontWeight: 700, padding: "4px 10px", borderRadius: 99 }}>Илгээсэн</span>
                            ) : (
                              <button onClick={() => { setSubmitTarget(a); setSubmitText(""); setSubmitError(""); }}
                                style={{ background: "#06b6d4", color: "white", border: "none", cursor: "pointer", fontSize: 12, fontWeight: 700, padding: "6px 14px", borderRadius: 8 }}>
                                Илгээх
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ASSIGNMENTS TAB */}
          {activeTab === "assignments" && (
            <div style={{ height: "100%", overflowY: "auto", padding: "24px 28px" }}>
              {assignments.length === 0 ? (
                <p style={{ textAlign: "center", color: "#9ca3af", padding: 40 }}>Даалгавар байхгүй</p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  {assignments.map(a => {
                    const sub = getSubmission(a.id);
                    const past = isPast(a.deadline);
                    return (
                      <div key={a.id} style={{ background: "white", borderRadius: 14, padding: 20, boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
                        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16 }}>
                          <div style={{ flex: 1 }}>
                            <h3 style={{ margin: "0 0 6px", fontSize: 16, fontWeight: 700, color: "#111827" }}>{a.title}</h3>
                            {a.description && <p style={{ margin: "0 0 10px", fontSize: 13, color: "#6b7280" }}>{a.description}</p>}
                            <div style={{ display: "flex", gap: 16, fontSize: 12, color: "#9ca3af" }}>
                              <span>Эцсийн хугацаа: {fmtDate(a.deadline)}</span>
                              <span>{a.points} оноо</span>
                            </div>
                          </div>
                          <div>
                            {sub ? (
                              <div style={{ textAlign: "right" }}>
                                <span style={{ background: "#dcfce7", color: "#16a34a", fontSize: 12, fontWeight: 700, padding: "6px 12px", borderRadius: 99 }}>
                                  {sub.score !== null ? `${sub.score}%` : "Илгээсэн"}
                                </span>
                                <p style={{ margin: "8px 0 0", fontSize: 11, color: "#9ca3af" }}>{relTime(sub.submitted_at)}</p>
                              </div>
                            ) : past ? (
                              <span style={{ background: "#fee2e2", color: "#ef4444", fontSize: 12, fontWeight: 700, padding: "6px 12px", borderRadius: 99 }}>Хугацаа дууссан</span>
                            ) : (
                              <button onClick={() => { setSubmitTarget(a); setSubmitText(""); setSubmitError(""); }}
                                style={{ background: "#06b6d4", color: "white", border: "none", cursor: "pointer", fontSize: 13, fontWeight: 700, padding: "8px 18px", borderRadius: 10 }}>
                                Илгээх
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* CHAT TAB */}
          {activeTab === "chat" && (
            <div style={{ height: "100%", display: "flex", overflow: "hidden" }}>
              {/* Teacher selection sidebar */}
              <div style={{ width: 280, borderRight: "1px solid #e5e7eb", background: "white", display: "flex", flexDirection: "column" }}>
                <div style={{ padding: 16, borderBottom: "1px solid #e5e7eb" }}>
                  <p style={{ margin: "0 0 12px", fontSize: 14, fontWeight: 700, color: "#111827" }}>Багш сонгох</p>
                  <input
                    type="email"
                    placeholder="Багшийн @olula.edu.mn email..."
                    value={teacherEmail}
                    onChange={(e) => {
                      setTeacherEmail(e.target.value);
                      setSelectedTeacher(null);
                    }}
                    style={{ width: "100%", padding: "10px 14px", borderRadius: 10, border: "1px solid #e5e7eb", fontSize: 13, outline: "none" }}
                  />
                  {teacherEmail && !teacherEmail.endsWith("@olula.edu.mn") && (
                    <p style={{ margin: "8px 0 0", fontSize: 11, color: "#ef4444" }}>@olula.edu.mn имэйл байх ёстой</p>
                  )}
                </div>
                
                <div style={{ flex: 1, overflowY: "auto", padding: 8 }}>
                  <p style={{ margin: "8px 8px 12px", fontSize: 11, color: "#9ca3af", fontWeight: 600 }}>Бүртгэлтэй багш нар</p>
                  {teachers.length === 0 ? (
                    <p style={{ padding: 16, fontSize: 12, color: "#9ca3af", textAlign: "center" }}>Багш бүртгэлгүй</p>
                  ) : (
                    teachers.map(t => (
                      <button
                        key={t.id}
                        onClick={() => {
                          setSelectedTeacher(t.id);
                          setTeacherEmail(t.email);
                        }}
                        style={{
                          width: "100%",
                          padding: "12px",
                          borderRadius: 10,
                          border: "none",
                          background: selectedTeacher === t.id ? "#e0f7fa" : "transparent",
                          cursor: "pointer",
                          textAlign: "left",
                          marginBottom: 4
                        }}
                      >
                        <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: "#111827" }}>
                          {t.last_name} {t.first_name}
                        </p>
                        <p style={{ margin: "2px 0 0", fontSize: 11, color: "#9ca3af" }}>{t.email}</p>
                      </button>
                    ))
                  )}
                </div>
              </div>

              {/* Chat area */}
              <div style={{ flex: 1, display: "flex", flexDirection: "column", background: "#f8fafc" }}>
                {(!selectedTeacher && !teacherEmail.endsWith("@olula.edu.mn")) ? (
                  <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <div style={{ textAlign: "center", color: "#9ca3af" }}>
                      <svg width="48" height="48" viewBox="0 0 24 24" fill="currentColor" style={{ marginBottom: 16 }}><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/></svg>
                      <p style={{ margin: 0, fontSize: 14 }}>Багш сонгоод эсвэл @olula.edu.mn email оруулна уу</p>
                    </div>
                  </div>
                ) : (
                  <>
                    {/* Chat header */}
                    <div style={{ padding: "16px 20px", background: "white", borderBottom: "1px solid #e5e7eb" }}>
                      <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: "#111827" }}>
                        {selectedTeacher ? teachers.find(t => t.id === selectedTeacher)?.email : teacherEmail}
                      </p>
                    </div>

                    {/* Messages */}
                    <div style={{ flex: 1, overflowY: "auto", padding: 20 }}>
                      {chatMessages.length === 0 ? (
                        <p style={{ textAlign: "center", color: "#9ca3af", fontSize: 13 }}>Мессеж байхгүй. Эхлээд бичнэ үү!</p>
                      ) : (
                        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                          {chatMessages.map(msg => {
                            const isMe = msg.from_id === user.id;
                            return (
                              <div key={msg.id} style={{ display: "flex", justifyContent: isMe ? "flex-end" : "flex-start" }}>
                                <div style={{
                                  maxWidth: "70%",
                                  padding: "12px 16px",
                                  borderRadius: 16,
                                  background: isMe ? "#06b6d4" : "white",
                                  color: isMe ? "white" : "#111827",
                                  boxShadow: "0 1px 3px rgba(0,0,0,0.1)"
                                }}>
                                  <p style={{ margin: 0, fontSize: 14 }}>{msg.text}</p>
                                  <p style={{ margin: "6px 0 0", fontSize: 10, opacity: 0.7 }}>{relTime(msg.sent_at)}</p>
                                </div>
                              </div>
                            );
                          })}
                          <div ref={chatBottomRef} />
                        </div>
                      )}
                    </div>

                    {/* Input */}
                    <form onSubmit={handleSendChat} style={{ padding: 16, background: "white", borderTop: "1px solid #e5e7eb", display: "flex", gap: 12 }}>
                      <input
                        type="text"
                        placeholder="Мессеж бичих..."
                        value={chatInput}
                        onChange={(e) => setChatInput(e.target.value)}
                        style={{ flex: 1, padding: "12px 16px", borderRadius: 12, border: "1px solid #e5e7eb", fontSize: 14, outline: "none" }}
                      />
                      <button
                        type="submit"
                        disabled={chatSending || !chatInput.trim()}
                        style={{
                          padding: "12px 24px",
                          borderRadius: 12,
                          border: "none",
                          background: "#06b6d4",
                          color: "white",
                          fontWeight: 700,
                          cursor: "pointer",
                          opacity: chatSending || !chatInput.trim() ? 0.6 : 1
                        }}
                      >
                        Илгээх
                      </button>
                    </form>
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Submit Modal */}
      {submitTarget && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100 }}>
          <div style={{ background: "white", borderRadius: 20, padding: 28, width: 440, maxWidth: "90%" }}>
            <h3 style={{ margin: "0 0 8px", fontSize: 18, fontWeight: 700, color: "#111827" }}>{submitTarget.title}</h3>
            <p style={{ margin: "0 0 20px", fontSize: 13, color: "#9ca3af" }}>Даалгаврын хариулт илгээх</p>
            
            <form onSubmit={handleSubmit}>
              <textarea
                placeholder="Хариулт бичих..."
                value={submitText}
                onChange={(e) => setSubmitText(e.target.value)}
                style={{ width: "100%", height: 120, padding: 14, borderRadius: 12, border: "1px solid #e5e7eb", fontSize: 14, resize: "none", outline: "none" }}
              />
              
              {submitError && (
                <p style={{ margin: "12px 0 0", color: "#ef4444", fontSize: 13 }}>{submitError}</p>
              )}

              <div style={{ display: "flex", gap: 12, marginTop: 20 }}>
                <button
                  type="button"
                  onClick={() => setSubmitTarget(null)}
                  style={{ flex: 1, padding: 14, borderRadius: 12, border: "1px solid #e5e7eb", background: "white", fontWeight: 600, cursor: "pointer", color: "#6b7280" }}
                >
                  Буцах
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  style={{ flex: 1, padding: 14, borderRadius: 12, border: "none", background: "#06b6d4", color: "white", fontWeight: 700, cursor: "pointer", opacity: submitting ? 0.6 : 1 }}
                >
                  {submitting ? "Илгээж байна..." : "Илгээх"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
