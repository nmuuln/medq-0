"use client";
import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { isPast, fmtDate, fmtDateTime, relTime } from "@/lib/formatters";

const AVATAR_COLORS = ["#f97316","#06b6d4","#8b5cf6","#10b981","#f59e0b","#ef4444","#3b82f6","#ec4899"];
function avatarColor(str) {
  if (!str) return AVATAR_COLORS[0];
  let n = 0; for (let i = 0; i < str.length; i++) n += str.charCodeAt(i);
  return AVATAR_COLORS[n % AVATAR_COLORS.length];
}
function initials(p) {
  if (p.last_name && p.first_name) return (p.last_name[0] + p.first_name[0]).toUpperCase();
  return (p.email || "?")[0].toUpperCase();
}
function displayName(p) {
  if (p.last_name && p.first_name) return `${p.last_name[0]}.${p.first_name}`;
  return p.email.split("@")[0];
}

const NAV = [
  { key:"dashboard", label:"Хяналтын самбар", badge:null, icon:<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/></svg> },
  { key:"assignments", label:"Даалгаврууд", badge:null, icon:<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M14 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z"/></svg> },
  { key:"students", label:"Сурагчид", badge:null, icon:<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"/></svg> },
  { key:"chat", label:"Чат", badge:null, icon:<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/></svg> },
];

const EMPTY_FORM = { title:"", description:"", grade:"", deadline:"", points:100 };

export default function TeacherDashboard() {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [students, setStudents] = useState([]);
  const [activeNav, setActiveNav] = useState("dashboard");
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const supabase = createClient();

  // assignments state
  const [assignments, setAssignments] = useState([]);
  const [selectedAssignment, setSelectedAssignment] = useState(null);
  const [submissions, setSubmissions] = useState([]);
  const [loadingSubs, setLoadingSubs] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");

  // grade modal
  const [gradeTarget, setGradeTarget] = useState(null);
  const [gradeInput, setGradeInput] = useState("");
  const [grading, setGrading] = useState(false);

  // all submissions
  const [allSubmissions, setAllSubmissions] = useState([]);

  // chat
  const [chatMessages, setChatMessages] = useState([]);
  const [selectedChatStudent, setSelectedChatStudent] = useState(null);
  const [chatInput, setChatInput] = useState("");
  const [chatSending, setChatSending] = useState(false);
  const [allChatMessages, setAllChatMessages] = useState([]);
  const chatBottomRef = useRef(null);

  // Auth check
  useEffect(() => {
    async function checkAuth() {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser) {
        router.push("/");
        return;
      }
      setUser(authUser);

      const { data: profileData } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", authUser.id)
        .single();

      if (!profileData || profileData.role !== "teacher") {
        router.push("/");
        return;
      }
      setProfile(profileData);
      setLoading(false);
    }
    checkAuth();
  }, [router, supabase]);

  // Load students (all students who have messaged this teacher or are in their classes)
  useEffect(() => {
    if (!profile) return;
    async function loadStudents() {
      const { data } = await supabase
        .from("profiles")
        .select("*")
        .eq("role", "student");
      setStudents(data || []);
    }
    loadStudents();
  }, [profile, supabase]);

  // Load assignments
  const loadAssignments = useCallback(async () => {
    if (!profile) return;
    const { data } = await supabase
      .from("assignments")
      .select("*")
      .eq("teacher_id", profile.id)
      .order("created_at", { ascending: false });
    setAssignments(data || []);
  }, [profile, supabase]);

  useEffect(() => {
    if (profile && activeNav === "assignments") loadAssignments();
  }, [profile, activeNav, loadAssignments]);

  // Load submissions for selected assignment
  useEffect(() => {
    if (!selectedAssignment) return;
    setLoadingSubs(true);
    supabase
      .from("submissions")
      .select("*, profiles!submissions_student_id_fkey(first_name, last_name, email, grade)")
      .eq("assignment_id", selectedAssignment.id)
      .then(({ data }) => {
        setSubmissions(data || []);
        setLoadingSubs(false);
      });
  }, [selectedAssignment, supabase]);

  // Load all submissions for dashboard
  useEffect(() => {
    if (!profile) return;
    async function loadAllSubs() {
      const { data: teacherAssignments } = await supabase
        .from("assignments")
        .select("id")
        .eq("teacher_id", profile.id);
      
      if (teacherAssignments && teacherAssignments.length > 0) {
        const assignmentIds = teacherAssignments.map(a => a.id);
        const { data } = await supabase
          .from("submissions")
          .select("*, profiles!submissions_student_id_fkey(first_name, last_name, email, grade)")
          .in("assignment_id", assignmentIds)
          .order("submitted_at", { ascending: false });
        setAllSubmissions(data || []);
      }
    }
    loadAllSubs();
    const iv = setInterval(loadAllSubs, 10000);
    return () => clearInterval(iv);
  }, [profile, supabase]);

  async function logout() {
    await supabase.auth.signOut();
    router.push("/");
  }

  async function handleCreate(e) {
    e.preventDefault();
    setCreateError("");
    setCreating(true);
    try {
      const { error } = await supabase
        .from("assignments")
        .insert({
          teacher_id: profile.id,
          title: form.title,
          description: form.description,
          grade: Number(form.grade),
          deadline: form.deadline,
          points: Number(form.points),
        });
      if (error) throw error;
      setShowCreate(false);
      setForm(EMPTY_FORM);
      loadAssignments();
    } catch(err) {
      setCreateError(err.message);
    } finally {
      setCreating(false);
    }
  }

  async function handleGrade(e) {
    e.preventDefault();
    setGrading(true);
    try {
      const { data, error } = await supabase
        .from("submissions")
        .update({ score: Number(gradeInput), graded_at: new Date().toISOString() })
        .eq("id", gradeTarget.id)
        .select("*, profiles!submissions_student_id_fkey(first_name, last_name, email, grade)")
        .single();
      if (error) throw error;
      setSubmissions(prev => prev.map(s => s.id === gradeTarget.id ? data : s));
      setAllSubmissions(prev => prev.map(s => s.id === gradeTarget.id ? data : s));
      setGradeTarget(null);
      setGradeInput("");
    } catch(err) {
      alert(err.message);
    } finally {
      setGrading(false);
    }
  }

  // Chat - load all messages for this teacher
  useEffect(() => {
    if (!profile || activeNav !== "chat") return;
    async function loadAllChats() {
      const { data } = await supabase
        .from("messages")
        .select("*")
        .or(`from_user_id.eq.${profile.id},to_user_id.eq.${profile.id}`)
        .order("sent_at", { ascending: false });
      setAllChatMessages(data || []);
    }
    loadAllChats();
    const iv = setInterval(loadAllChats, 5000);
    return () => clearInterval(iv);
  }, [profile, activeNav, supabase]);

  // Load chat with selected student
  const loadChat = useCallback(async (studentId) => {
    if (!profile || !studentId) return;
    const { data } = await supabase
      .from("messages")
      .select("*")
      .or(`and(from_user_id.eq.${profile.id},to_user_id.eq.${studentId}),and(from_user_id.eq.${studentId},to_user_id.eq.${profile.id})`)
      .order("sent_at", { ascending: true });
    setChatMessages(data || []);
  }, [profile, supabase]);

  useEffect(() => {
    if (!selectedChatStudent) return;
    loadChat(selectedChatStudent.id);
    const iv = setInterval(() => loadChat(selectedChatStudent.id), 5000);
    return () => clearInterval(iv);
  }, [selectedChatStudent, loadChat]);

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

  async function handleSendChat(e) {
    e.preventDefault();
    if (!chatInput.trim() || !selectedChatStudent) return;
    setChatSending(true);
    try {
      const { data, error } = await supabase
        .from("messages")
        .insert({
          from_user_id: profile.id,
          to_user_id: selectedChatStudent.id,
          text: chatInput,
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

  // Students who have messaged
  const chatStudents = useMemo(() => {
    const studentIds = new Set();
    allChatMessages.forEach(m => {
      if (m.from_user_id !== profile?.id) studentIds.add(m.from_user_id);
      if (m.to_user_id !== profile?.id) studentIds.add(m.to_user_id);
    });
    return students.filter(s => studentIds.has(s.id));
  }, [students, allChatMessages, profile]);

  // Unread count per student
  const getUnreadCount = (studentId) => {
    const convo = allChatMessages
      .filter(m => m.from_user_id === studentId || m.to_user_id === studentId)
      .sort((a, b) => new Date(b.sent_at) - new Date(a.sent_at));
    return convo.length > 0 && convo[0].from_user_id === studentId ? 1 : 0;
  };

  const chatBadge = useMemo(() => {
    return chatStudents.reduce((sum, s) => sum + getUnreadCount(s.id), 0) || null;
  }, [chatStudents, allChatMessages]);

  if (loading || !profile) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", background: "#f8f9fa" }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ width: 40, height: 40, border: "3px solid #f97316", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 1s linear infinite", margin: "0 auto 16px" }} />
          <p style={{ color: "#6b7280" }}>Ачаалж байна...</p>
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  const teacherInitial = initials(profile);
  const teacherDisplay = displayName(profile);

  return (
    <div className="flex" style={{ background:"#f8f9fa", height:"100vh", overflow:"hidden", color:"#111827" }}>
      {/* Sidebar */}
      <aside className="w-56 flex flex-col shrink-0" style={{ background:"#f97316" }}>
        <div className="flex items-center gap-3 px-5 py-5">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center font-black text-lg shrink-0" style={{ background:"rgba(255,255,255,0.25)", color:"white" }}>
            {teacherInitial}
          </div>
          <div>
            <p className="font-bold text-white text-sm leading-tight">Багшийн самбар</p>
            <p className="text-orange-200 text-xs">@olula.edu.mn</p>
          </div>
        </div>
        <nav className="flex-1 px-3 py-2 flex flex-col gap-1">
          {NAV.map(item => {
            const active = activeNav === item.key;
            const badge = item.key === "assignments" ? (assignments.filter(a => !isPast(a.deadline)).length || null)
              : item.key === "chat" ? chatBadge : item.badge;
            return (
              <button key={item.key} onClick={() => setActiveNav(item.key)}
                className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all text-left"
                style={active ? { background:"white", color:"#f97316" } : { background:"transparent", color:"rgba(255,255,255,0.85)" }}>
                {item.icon}
                <span className="flex-1">{item.label}</span>
                {badge && (
                  <span className="text-xs px-1.5 py-0.5 rounded-full font-bold"
                    style={active ? { background:"#f97316", color:"white" } : { background:"rgba(255,255,255,0.25)", color:"white" }}>
                    {badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
        <div className="mx-3 mb-4 flex items-center gap-3 px-4 py-3 rounded-2xl" style={{ background:"rgba(255,255,255,0.15)" }}>
          <div className="w-9 h-9 rounded-xl flex items-center justify-center font-bold text-sm shrink-0" style={{ background:"rgba(255,255,255,0.9)", color:"#f97316" }}>
            {teacherInitial}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-white font-semibold text-sm truncate">{teacherDisplay}</p>
            <p className="text-orange-200 text-xs">Багш</p>
          </div>
          <button onClick={logout} title="Гарах">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="rgba(255,255,255,0.7)">
              <path d="M17 7l-1.41 1.41L18.17 11H8v2h10.17l-2.58 2.58L17 17l5-5-5-5zM4 5h8V3H4c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h8v-2H4V5z"/>
            </svg>
          </button>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="bg-white px-8 py-4 flex items-center justify-between shrink-0 border-b border-gray-100">
          <div>
            <h1 className="text-xl font-bold text-gray-900">
              {activeNav === "dashboard" && `Сайн байна уу, ${teacherDisplay}!`}
              {activeNav === "assignments" && "Даалгаврууд"}
              {activeNav === "students" && "Сурагчид"}
              {activeNav === "chat" && "Чат"}
            </h1>
            <p className="text-sm text-gray-400">
              {activeNav === "dashboard" && "Өнөөдөр ажлаа амжилттай явуулаарай"}
              {activeNav === "assignments" && `${assignments.length} даалгавар нийт`}
              {activeNav === "students" && `${students.length} сурагч`}
              {activeNav === "chat" && `${chatStudents.length} харилцагч`}
            </p>
          </div>
        </header>

        <div className="flex-1 overflow-hidden">

          {/* DASHBOARD */}
          {activeNav === "dashboard" && (
            <div className="h-full overflow-y-auto px-8 py-6">
              <div className="grid grid-cols-4 gap-5 mb-6">
                {[
                  { label:"Нийт сурагч", value: students.length, bg:"#fff7ed", fill:"#f97316", icon:<path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"/> },
                  { label:"Идэвхтэй даалгавар", value: assignments.filter(a => !isPast(a.deadline)).length, bg:"#eff6ff", fill:"#3b82f6", icon:<path d="M14 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z"/> },
                  { label:"Үнэлээгүй илгээлт", value: allSubmissions.filter(s => s.score === null).length, bg:"#fef3c7", fill:"#f59e0b", icon:<path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/> },
                  { label:"Нийт илгээлт", value: allSubmissions.length, bg:"#f0fdf4", fill:"#10b981", icon:<path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z"/> },
                ].map(s => (
                  <div key={s.label} className="bg-white rounded-2xl p-5 shadow-sm flex items-center justify-between">
                    <div>
                      <p className="text-xs text-gray-400 mb-1">{s.label}</p>
                      <p className="text-3xl font-black text-gray-900">{s.value}</p>
                    </div>
                    <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0" style={{ background:s.bg }}>
                      <svg width="22" height="22" viewBox="0 0 24 24" fill={s.fill}>{s.icon}</svg>
                    </div>
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-3 gap-5">
                <div className="col-span-2 bg-white rounded-2xl p-6 shadow-sm">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="font-bold text-gray-900">Сүүлийн илгээлтүүд</h2>
                    {allSubmissions.filter(s => s.score === null).length > 0 && (
                      <span className="text-xs px-3 py-1 rounded-full font-semibold" style={{ background:"#fff7ed", color:"#f97316" }}>
                        {allSubmissions.filter(s => s.score === null).length} үнэлэгдээгүй
                      </span>
                    )}
                  </div>
                  {allSubmissions.length === 0 ? (
                    <div className="flex items-center justify-center h-32">
                      <p className="text-gray-300 text-sm">Одоохондоо илгээлт байхгүй</p>
                    </div>
                  ) : (
                    <div className="flex flex-col divide-y divide-gray-50">
                      {allSubmissions.slice(0, 5).map(sub => {
                        const asgn = assignments.find(a => a.id === sub.assignment_id);
                        const studentName = sub.profiles ? displayName(sub.profiles) : "Сурагч";
                        const studentInit = sub.profiles ? initials(sub.profiles) : "?";
                        return (
                          <div key={sub.id} className="flex items-center gap-4 py-3">
                            <div className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm text-white shrink-0"
                              style={{ background: avatarColor(sub.profiles?.email) }}>
                              {studentInit}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-semibold text-sm text-gray-900">{studentName}</p>
                              <p className="text-xs text-gray-400">{asgn?.title || "Даалгавар"} • {relTime(sub.submitted_at)}</p>
                            </div>
                            {sub.score !== null ? (
                              <span className="text-lg font-bold" style={{ color: sub.score >= 80 ? "#10b981" : sub.score >= 50 ? "#f59e0b" : "#ef4444" }}>
                                {sub.score}%
                              </span>
                            ) : (
                              <button
                                onClick={() => { setGradeTarget(sub); setGradeInput(""); }}
                                className="text-xs px-3 py-1.5 rounded-lg font-semibold"
                                style={{ background:"#f97316", color:"white" }}>
                                Үнэлэх
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div className="bg-white rounded-2xl p-6 shadow-sm">
                  <h2 className="font-bold text-gray-900 mb-4">Чат харилцагчид</h2>
                  {chatStudents.length === 0 ? (
                    <p className="text-center text-gray-300 text-sm py-8">Одоохондоо чат байхгүй</p>
                  ) : (
                    <div className="flex flex-col gap-2">
                      {chatStudents.slice(0, 5).map(s => {
                        const unread = getUnreadCount(s.id);
                        return (
                          <div key={s.id}
                            onClick={() => { setSelectedChatStudent(s); setActiveNav("chat"); }}
                            className="flex items-center gap-3 p-2 rounded-xl cursor-pointer hover:bg-gray-50">
                            <div className="w-9 h-9 rounded-full flex items-center justify-center font-bold text-xs text-white shrink-0"
                              style={{ background: avatarColor(s.email) }}>
                              {initials(s)}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-semibold text-sm text-gray-900">{displayName(s)}</p>
                              <p className="text-xs text-gray-400">{s.grade}-р анги</p>
                            </div>
                            {unread > 0 && <span className="w-2 h-2 rounded-full bg-orange-500" />}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ASSIGNMENTS */}
          {activeNav === "assignments" && (
            <div className="h-full flex">
              {/* Left - assignment list */}
              <div className="w-80 border-r border-gray-100 flex flex-col bg-white">
                <div className="p-4 border-b border-gray-100">
                  <button
                    onClick={() => setShowCreate(true)}
                    className="w-full py-2.5 rounded-xl font-semibold text-sm"
                    style={{ background:"#f97316", color:"white" }}>
                    + Шинэ даалгавар
                  </button>
                </div>
                <div className="flex-1 overflow-y-auto p-2">
                  {assignments.length === 0 ? (
                    <p className="text-center text-gray-300 text-sm py-8">Даалгавар байхгүй</p>
                  ) : (
                    assignments.map(a => {
                      const isActive = selectedAssignment?.id === a.id;
                      const past = isPast(a.deadline);
                      return (
                        <div key={a.id}
                          onClick={() => setSelectedAssignment(a)}
                          className="p-3 rounded-xl cursor-pointer mb-1"
                          style={{ background: isActive ? "#fff7ed" : "transparent" }}>
                          <div className="flex items-center justify-between mb-1">
                            <p className="font-semibold text-sm text-gray-900">{a.title}</p>
                            {past && <span className="text-xs text-gray-400">Дууссан</span>}
                          </div>
                          <p className="text-xs text-gray-400">{a.grade}-р анги • {fmtDate(a.deadline)}</p>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Right - submissions */}
              <div className="flex-1 overflow-y-auto p-6">
                {!selectedAssignment ? (
                  <div className="flex items-center justify-center h-full">
                    <p className="text-gray-300 text-sm">Даалгавар сонгоно уу</p>
                  </div>
                ) : (
                  <>
                    <div className="mb-6">
                      <h2 className="text-xl font-bold text-gray-900">{selectedAssignment.title}</h2>
                      {selectedAssignment.description && (
                        <p className="text-gray-500 mt-1">{selectedAssignment.description}</p>
                      )}
                      <div className="flex items-center gap-4 mt-2 text-sm text-gray-400">
                        <span>{selectedAssignment.grade}-р анги</span>
                        <span>•</span>
                        <span>Хугацаа: {fmtDate(selectedAssignment.deadline)}</span>
                        <span>•</span>
                        <span>{selectedAssignment.points} оноо</span>
                      </div>
                    </div>

                    <h3 className="font-semibold text-gray-900 mb-3">Илгээлтүүд ({submissions.length})</h3>
                    {loadingSubs ? (
                      <p className="text-gray-300 text-sm">Ачаалж байна...</p>
                    ) : submissions.length === 0 ? (
                      <p className="text-gray-300 text-sm">Илгээлт байхгүй</p>
                    ) : (
                      <div className="space-y-3">
                        {submissions.map(sub => {
                          const studentName = sub.profiles ? displayName(sub.profiles) : "Сурагч";
                          const studentInit = sub.profiles ? initials(sub.profiles) : "?";
                          return (
                            <div key={sub.id} className="bg-white rounded-xl p-4 shadow-sm flex items-center gap-4">
                              <div className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm text-white shrink-0"
                                style={{ background: avatarColor(sub.profiles?.email) }}>
                                {studentInit}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="font-semibold text-sm text-gray-900">{studentName}</p>
                                <p className="text-xs text-gray-400">{sub.profiles?.grade}-р анги • {relTime(sub.submitted_at)}</p>
                                {sub.text && <p className="text-sm text-gray-600 mt-1">{sub.text}</p>}
                              </div>
                              {sub.score !== null ? (
                                <span className="text-xl font-bold" style={{ color: sub.score >= 80 ? "#10b981" : sub.score >= 50 ? "#f59e0b" : "#ef4444" }}>
                                  {sub.score}%
                                </span>
                              ) : (
                                <button
                                  onClick={() => { setGradeTarget(sub); setGradeInput(""); }}
                                  className="px-4 py-2 rounded-lg font-semibold text-sm"
                                  style={{ background:"#f97316", color:"white" }}>
                                  Үнэлэх
                                </button>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          )}

          {/* STUDENTS */}
          {activeNav === "students" && (
            <div className="h-full overflow-y-auto p-6">
              <div className="grid grid-cols-3 gap-4">
                {students.map(s => {
                  const scored = allSubmissions.filter(sub => sub.student_id === s.id && sub.score !== null);
                  const avg = scored.length > 0 ? Math.round(scored.reduce((sum, sub) => sum + sub.score, 0) / scored.length) : null;
                  return (
                    <div key={s.id} className="bg-white rounded-xl p-4 shadow-sm flex items-center gap-4">
                      <div className="w-12 h-12 rounded-full flex items-center justify-center font-bold text-white shrink-0"
                        style={{ background: avatarColor(s.email) }}>
                        {initials(s)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-gray-900">{displayName(s)}</p>
                        <p className="text-xs text-gray-400">{s.grade}-р анги • {s.email}</p>
                      </div>
                      {avg !== null && (
                        <span className="text-lg font-bold" style={{ color: avg >= 80 ? "#10b981" : avg >= 50 ? "#f59e0b" : "#ef4444" }}>
                          {avg}%
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* CHAT */}
          {activeNav === "chat" && (
            <div className="flex h-full">
              {/* Student list */}
              <div className="w-72 border-r border-gray-100 flex flex-col bg-white">
                <div className="p-4 border-b border-gray-100">
                  <p className="font-semibold text-gray-900">Харилцагчид</p>
                  <p className="text-xs text-gray-400">{chatStudents.length} сурагч</p>
                </div>
                <div className="flex-1 overflow-y-auto p-2">
                  {chatStudents.length === 0 ? (
                    <p className="text-center text-gray-300 text-sm py-8">Чат байхгүй</p>
                  ) : (
                    chatStudents.map(s => {
                      const isSelected = selectedChatStudent?.id === s.id;
                      const unread = getUnreadCount(s.id);
                      const lastMsg = allChatMessages
                        .filter(m => m.from_user_id === s.id || m.to_user_id === s.id)
                        .sort((a, b) => new Date(b.sent_at) - new Date(a.sent_at))[0];
                      return (
                        <div key={s.id}
                          onClick={() => setSelectedChatStudent(s)}
                          className="flex items-center gap-3 p-3 rounded-xl cursor-pointer mb-1"
                          style={{ background: isSelected ? "#fff7ed" : "transparent" }}>
                          <div className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm text-white shrink-0"
                            style={{ background: avatarColor(s.email) }}>
                            {initials(s)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between">
                              <p className="font-semibold text-sm text-gray-900">{displayName(s)}</p>
                              {unread > 0 && <span className="w-2 h-2 rounded-full bg-orange-500" />}
                            </div>
                            <p className="text-xs text-gray-400 truncate">
                              {lastMsg ? lastMsg.text.substring(0, 25) + (lastMsg.text.length > 25 ? "..." : "") : s.email}
                            </p>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Chat area */}
              <div className="flex-1 flex flex-col bg-gray-50">
                {!selectedChatStudent ? (
                  <div className="flex-1 flex items-center justify-center">
                    <div className="text-center text-gray-400">
                      <svg width="48" height="48" viewBox="0 0 24 24" fill="currentColor" className="mx-auto mb-3 opacity-50">
                        <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/>
                      </svg>
                      <p className="text-sm">Сурагч сонгоод чат эхлүүлээрэй</p>
                    </div>
                  </div>
                ) : (
                  <>
                    {/* Chat header */}
                    <div className="p-4 bg-white border-b border-gray-100 flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm text-white"
                        style={{ background: avatarColor(selectedChatStudent.email) }}>
                        {initials(selectedChatStudent)}
                      </div>
                      <div>
                        <p className="font-semibold text-gray-900">{displayName(selectedChatStudent)}</p>
                        <p className="text-xs text-gray-400">{selectedChatStudent.grade}-р анги • {selectedChatStudent.email}</p>
                      </div>
                    </div>

                    {/* Messages */}
                    <div className="flex-1 overflow-y-auto p-4">
                      {chatMessages.length === 0 ? (
                        <p className="text-center text-gray-300 text-sm py-8">Мессеж байхгүй</p>
                      ) : (
                        <div className="space-y-3">
                          {chatMessages.map(m => {
                            const isMe = m.from_user_id === profile.id;
                            return (
                              <div key={m.id} className={`flex ${isMe ? "justify-end" : "justify-start"}`}>
                                <div className={`max-w-[70%] px-4 py-2.5 rounded-2xl ${isMe ? "rounded-br-sm" : "rounded-bl-sm"}`}
                                  style={{ background: isMe ? "#f97316" : "white", color: isMe ? "white" : "#111827" }}>
                                  <p className="text-sm">{m.text}</p>
                                  <p className="text-xs mt-1 opacity-70 text-right">{relTime(m.sent_at)}</p>
                                </div>
                              </div>
                            );
                          })}
                          <div ref={chatBottomRef} />
                        </div>
                      )}
                    </div>

                    {/* Input */}
                    <form onSubmit={handleSendChat} className="p-4 bg-white border-t border-gray-100 flex gap-3">
                      <input
                        type="text"
                        value={chatInput}
                        onChange={e => setChatInput(e.target.value)}
                        placeholder="Мессеж бичих..."
                        className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 text-sm outline-none focus:border-orange-300"
                      />
                      <button
                        type="submit"
                        disabled={chatSending || !chatInput.trim()}
                        className="px-6 py-2.5 rounded-xl font-semibold text-sm disabled:opacity-50"
                        style={{ background:"#f97316", color:"white" }}>
                        {chatSending ? "..." : "Илгээх"}
                      </button>
                    </form>
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Create assignment modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 w-96 max-w-[90vw]">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-900">Шинэ даалгавар</h3>
              <button onClick={() => setShowCreate(false)} className="text-gray-400 text-xl">×</button>
            </div>
            <form onSubmit={handleCreate} className="space-y-4">
              <input
                type="text"
                placeholder="Гарчиг"
                value={form.title}
                onChange={e => setForm({ ...form, title: e.target.value })}
                required
                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm outline-none"
              />
              <textarea
                placeholder="Тайлбар (заавал биш)"
                value={form.description}
                onChange={e => setForm({ ...form, description: e.target.value })}
                rows={3}
                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm outline-none resize-none"
              />
              <div className="grid grid-cols-2 gap-3">
                <input
                  type="number"
                  placeholder="Анги (1-12)"
                  value={form.grade}
                  onChange={e => setForm({ ...form, grade: e.target.value })}
                  required
                  min={1}
                  max={12}
                  className="px-4 py-2.5 rounded-xl border border-gray-200 text-sm outline-none"
                />
                <input
                  type="number"
                  placeholder="Оноо"
                  value={form.points}
                  onChange={e => setForm({ ...form, points: e.target.value })}
                  required
                  className="px-4 py-2.5 rounded-xl border border-gray-200 text-sm outline-none"
                />
              </div>
              <input
                type="datetime-local"
                value={form.deadline}
                onChange={e => setForm({ ...form, deadline: e.target.value })}
                required
                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm outline-none"
              />
              {createError && <p className="text-red-500 text-sm">{createError}</p>}
              <button
                type="submit"
                disabled={creating}
                className="w-full py-2.5 rounded-xl font-semibold text-sm disabled:opacity-50"
                style={{ background:"#f97316", color:"white" }}>
                {creating ? "Үүсгэж байна..." : "Үүсгэх"}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Grade modal */}
      {gradeTarget && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 w-80">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-900">Үнэлгээ өгөх</h3>
              <button onClick={() => setGradeTarget(null)} className="text-gray-400 text-xl">×</button>
            </div>
            <p className="text-sm text-gray-500 mb-4">
              {gradeTarget.profiles ? displayName(gradeTarget.profiles) : "Сурагч"}
            </p>
            {gradeTarget.text && (
              <p className="text-sm text-gray-600 mb-4 p-3 bg-gray-50 rounded-xl">{gradeTarget.text}</p>
            )}
            <form onSubmit={handleGrade}>
              <input
                type="number"
                placeholder="Оноо (0-100)"
                value={gradeInput}
                onChange={e => setGradeInput(e.target.value)}
                required
                min={0}
                max={100}
                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm outline-none mb-4"
              />
              <button
                type="submit"
                disabled={grading}
                className="w-full py-2.5 rounded-xl font-semibold text-sm disabled:opacity-50"
                style={{ background:"#f97316", color:"white" }}>
                {grading ? "Хадгалж байна..." : "Хадгалах"}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
