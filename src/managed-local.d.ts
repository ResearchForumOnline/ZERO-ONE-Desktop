interface ManagedLocalStatus {
  phase: "idle" | "downloading" | "verifying" | "starting" | "ready" | "error" | "cancelled";
  termsAccepted?: boolean;
  modelId?: string;
  name?: string;
  modelName?: string;
  completed?: number;
  total?: number;
  detail?: string;
  message?: string;
}
