export type LeadColumnId =
  | 'name'
  | 'role'
  | 'company'
  | 'email'
  | 'location'
  | 'status'
  | 'verified'
  | 'github'
  | 'linkedin'
  | 'createdAt'
  | 'pipeline';

export interface LeadColumnDef {
  id: LeadColumnId;
  label: string;
  defaultVisible: boolean;
  alwaysVisible?: boolean;
}

export const LEAD_COLUMNS: LeadColumnDef[] = [
  { id: 'name', label: 'Name', defaultVisible: true, alwaysVisible: true },
  { id: 'role', label: 'Role', defaultVisible: true },
  { id: 'company', label: 'Company', defaultVisible: true },
  { id: 'email', label: 'Email', defaultVisible: true },
  { id: 'location', label: 'Location', defaultVisible: false },
  { id: 'status', label: 'Status', defaultVisible: true },
  { id: 'verified', label: 'Verified', defaultVisible: false },
  { id: 'github', label: 'GitHub', defaultVisible: false },
  { id: 'linkedin', label: 'LinkedIn', defaultVisible: false },
  { id: 'createdAt', label: 'Added', defaultVisible: false },
  { id: 'pipeline', label: 'Pipeline error', defaultVisible: false },
];

const STORAGE_KEY = 'leadwolf-leads-table-prefs';

export interface LeadsTablePrefs {
  visibleColumns: LeadColumnId[];
  pageSize: number;
}

const DEFAULT_PREFS: LeadsTablePrefs = {
  visibleColumns: LEAD_COLUMNS.filter((c) => c.defaultVisible).map((c) => c.id),
  pageSize: 20,
};

export function loadLeadsTablePrefs(): LeadsTablePrefs {
  if (typeof window === 'undefined') return DEFAULT_PREFS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_PREFS;
    const parsed = JSON.parse(raw) as Partial<LeadsTablePrefs>;
    const validIds = new Set(LEAD_COLUMNS.map((c) => c.id));
    const visibleColumns = (parsed.visibleColumns ?? DEFAULT_PREFS.visibleColumns).filter(
      (id): id is LeadColumnId => validIds.has(id as LeadColumnId),
    );
    if (!visibleColumns.includes('name')) {
      visibleColumns.unshift('name');
    }
    const pageSize = [10, 20, 50, 100].includes(parsed.pageSize ?? 0)
      ? parsed.pageSize!
      : DEFAULT_PREFS.pageSize;
    return { visibleColumns, pageSize };
  } catch {
    return DEFAULT_PREFS;
  }
}

export function saveLeadsTablePrefs(prefs: LeadsTablePrefs) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
}
