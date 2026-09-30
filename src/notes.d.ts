interface LocalNote {
  id: string;
  title: string;
  content: string;
  updatedAt: string;
  pinned: boolean;
  state: "active" | "archived" | "trash";
  color: "midnight" | "violet" | "blue" | "teal" | "green" | "amber" | "rose";
  labels: string[];
  checklist: Array<{ id: string; text: string; done: boolean }>;
  reminder?: { start: string; timeZone: string; reminderMinutes: number } | null;
  createdAt?: string;
  deletedAt?: string;
  sourceVersion?: number;
}
