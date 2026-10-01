interface ZeroThinkResearchTemplate {
  id: string;
  name: string;
  description: string;
  kind: "paper" | "scenario" | "custom";
  processId: string;
  stages: string[];
  requiredSources: string[];
  validationChecks: string[];
  builtIn: boolean;
  updatedAt: string;
}
interface ZeroThinkTemplateInput {
  id?: string;
  name: string;
  description: string;
  kind: "paper" | "scenario" | "custom";
  processId: string;
  stages: string[];
  requiredSources: string[];
  validationChecks: string[];
}
interface ZeroThinkTemplateRequest {
  templateId?: string;
  kind?: "paper" | "scenario" | "custom";
  template?: ZeroThinkResearchTemplate;
  fields: Record<string, string>;
}
interface ZeroThinkTemplateAPI {
  listZeroThinkTemplates(): Promise<ZeroThinkResearchTemplate[]>;
  saveZeroThinkTemplate(input: ZeroThinkTemplateInput): Promise<ZeroThinkResearchTemplate>;
  deleteZeroThinkTemplate(id: string): Promise<boolean>;
  renderZeroThinkTemplate(input: ZeroThinkTemplateRequest): Promise<{ question: string; processId: string; title: string }>;
}
