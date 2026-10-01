interface ZeroThinkResearchProject {
  id: string; title: string; question: string; processId: string; maxPasses: number;
  useModel: boolean; zeroMode: boolean; autoWeb: boolean;
  documents: ZeroThinkDocument[]; result: ZeroThinkResult | null;
  status: "draft" | "running" | "completed" | "interrupted"; lastError: string; updatedAt: string;
}
type ZeroThinkResearchProjectInput = Omit<ZeroThinkResearchProject, "id" | "updatedAt"> & { id?: string };
interface ZeroThinkResearchProjectSummary {
  id: string; title: string; updatedAt: string; status: ZeroThinkResearchProject["status"]; sourceCount: number;
}
interface ZeroThinkProjectsAPI {
  listZeroThinkProjects(): Promise<ZeroThinkResearchProjectSummary[]>;
  getZeroThinkProject(id: string): Promise<ZeroThinkResearchProject | null>;
  saveZeroThinkProject(input: ZeroThinkResearchProjectInput): Promise<ZeroThinkResearchProject>;
  deleteZeroThinkProject(id: string): Promise<boolean>;
  exportZeroThinkProject(id: string): Promise<{ saved: boolean }>;
  importZeroThinkProject(): Promise<ZeroThinkResearchProject | null>;
}
