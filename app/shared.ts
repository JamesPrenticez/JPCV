// Imported by both the Express API (validation) and the React UI (dropdowns, types).
export const STATUSES = ["Saved", "Contacted", "Applied", "Interview", "Offer", "Rejected"] as const;
export const SOURCES = ["LinkedIn", "Seek", "Other"] as const;

export const LEVELS = ["Junior", "Intermediate", "Senior"] as const;
export const ROLE_TYPES = ["Frontend", "Backend", "Full stack"] as const;
export const APPROACHES = ["Advertised", "Cold approach"] as const; // cold = no advert, you reached out first
export const PRIORITIES = ["High", "Medium", "Low"] as const; // list order = sort order
export const LOCATIONS = ["Auckland", "Christchurch", "Dunedin", "Hamilton", "Queenstown", "Wellington", "Adelaide", "Melbourne", "Perth", "Sydney", "United Kingdom", "United States", "Poland", "Sweden", "Gibraltar", "Spain", "Romania", "Moldova", "Europe", "Remote"] as const;

export type Priority = (typeof PRIORITIES)[number];
export type Status = (typeof STATUSES)[number];
export type Source = (typeof SOURCES)[number];
export type Approach = (typeof APPROACHES)[number];
export type Level = (typeof LEVELS)[number];
export type RoleType = (typeof ROLE_TYPES)[number];
export type Location = (typeof LOCATIONS)[number];

export type Contact = { name: string; role: string; email: string; phone: string; linkedin: string };

export type Application = {
  id: number;
  company: string;
  priority: Priority;
  role_level: Level | ""; // "" if unset
  role_type: RoleType | "";
  location: Location | "";
  source: Source;
  status: Status;
  approach: Approach;
  date_applied: string; // YYYY-MM-DD, "" if unset
  follow_up_date: string;
  company_url: string;
  job_url: string;
  technologies: string[]; // buzzwords from the advert, e.g. ["TypeScript", "Pixi.js", "GDD"]
  contacts: Contact[]; // blank ones are dropped by the server
  notes: string;
  has_cv: boolean; // a saved copy of the CV exists in cv/versions/; derived, not a column
  has_cover_letter: boolean; // same, in cv/cover-letters/
};

/** The two documents saved per application; also the API path segment. */
export type Doc = "cv" | "cover-letter";

/** What the form holds and the client sends; the server validates it and fills in the rest. */
export type Draft = Partial<Application>;
