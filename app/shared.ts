// Imported by both the Express API (validation) and the React UI (dropdowns, types).
export const STATUSES = ["Saved", "Contacted", "Applied", "Interview", "Offer", "Rejected"] as const;
export const SOURCES = ["LinkedIn", "Seek", "Other"] as const;

export const LEVELS = ["Junior", "Intermediate", "Senior"] as const;
export const ROLE_TYPES = ["Frontend", "Backend", "Full stack"] as const;
export const PRIORITIES = ["High", "Medium", "Low"] as const; // list order = sort order

export type Priority = (typeof PRIORITIES)[number];
export type Status = (typeof STATUSES)[number];
export type Source = (typeof SOURCES)[number];
export type Level = (typeof LEVELS)[number];
export type RoleType = (typeof ROLE_TYPES)[number];

export type Application = {
  id: number;
  company: string;
  priority: Priority;
  role_level: Level | ""; // "" if unset
  role_type: RoleType | "";
  source: Source;
  status: Status;
  date_applied: string; // YYYY-MM-DD, "" if unset
  follow_up_date: string;
  company_url: string;
  job_url: string;
  contact_name: string;
  contact_role: string;
  contact_email: string;
  contact_phone: string;
  contact_linkedin: string;
  notes: string;
};

/** What the form holds and the client sends; the server validates it and fills in the rest. */
export type Draft = Partial<Application>;
