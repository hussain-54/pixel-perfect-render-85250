/**
 * Data service layer. Every UI read goes through these async functions.
 * Replace the bodies with backend queries later; signatures stay the same.
 */
import * as db from "@/data/mock";

const delay = <T,>(v: T): Promise<T> => new Promise((r) => setTimeout(() => r(v), 150));

export const getStages = () => db.STAGES;
export const getStudents = () => delay(db.students);
export const getStudent = (id: string) => delay(db.students.find((s) => s.id === id) ?? null);
export const getCurrentStudent = () => delay(db.students[0]);
export const getConsultants = () => delay(db.consultants);
export const getConsultant = (id: string) => delay(db.consultants.find((c) => c.id === id) ?? null);
export const getAppointments = (studentId?: string) =>
  delay(studentId ? db.appointments.filter((a) => a.studentId === studentId) : db.appointments);
export const getDocuments = (studentId?: string) =>
  delay(studentId ? db.documents.filter((d) => d.studentId === studentId) : db.documents);
export const getApplications = (studentId?: string) =>
  delay(studentId ? db.applications.filter((a) => a.studentId === studentId) : db.applications);
export const getLeads = () => delay(db.leads);
export const getUniversities = () => delay(db.universities);
export const getScholarships = () => delay(db.scholarships);
export const getNotifications = (audience: "student" | "staff" | "admin") =>
  delay(db.notifications.filter((n) => n.audience === audience));
export const getActivity = (studentId: string) => delay(db.activity[studentId] ?? db.activity.s1);
export const getAuditLogs = () => delay(db.auditLogs);
export const getMonthlyStats = () => delay(db.monthlyLeads);

/** Sync lookups for rendering names inside rows. */
export const lookupStudent = (id: string) => db.students.find((s) => s.id === id);
export const lookupConsultant = (id: string | null) => db.consultants.find((c) => c.id === id);
export const stageIndex = (key: string) => db.STAGES.findIndex((s) => s.key === key);
export const stageLabel = (key: string) => db.STAGES.find((s) => s.key === key)?.label ?? key;

/** Mock mutation — resolves successfully; wire to backend later. */
export const submitConsultationRequest = (_data: Record<string, string>) => delay({ ok: true, ref: "REQ-" + Math.floor(Math.random() * 9000 + 1000) });
