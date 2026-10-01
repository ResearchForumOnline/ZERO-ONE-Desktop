interface ZeroThinkQuantumGate { gate: string; target?: number; control?: number; targets?: number[]; rotation?: number }
interface ZeroThinkQuantumCircuit { qubits: number; gateset: "qis"; circuit: ZeroThinkQuantumGate[] }
interface ZeroThinkQuantumJob {
  id: string; status: string; backend?: string; name?: string; type?: string; dry_run?: boolean; shots?: number;
  submitted_at?: string; started_at?: string; completed_at?: string; execution_duration_ms?: number;
  stats?: { qubits?: number; circuits?: number; gate_counts?: Record<string, number> };
  results?: Record<string, { id: string; format: string; media_type?: string }>;
}
interface ZeroThinkQuantumRequest {
  action: "local" | "backends" | "jobs" | "job" | "probabilities" | "cost" | "estimate" | "submit" | "cancel";
  circuit?: ZeroThinkQuantumCircuit | string; shots?: number; seed?: number; backend?: string; name?: string; jobId?: string;
  confirmation?: string; approvalToken?: string; maxEstimatedCost?: number; costUnit?: string; acknowledgeCostMayExceedEstimate?: boolean;
}
interface ZeroThinkQuantumResult {
  version: string; action: string; recordedAt: string; provenance: string; warnings: string[];
  backend?: string; status?: string; input?: ZeroThinkQuantumCircuit; shots?: number; seed?: number;
  probabilities?: Record<string, number>; counts?: Record<string, number>; normalization?: number; qubitOrder?: string;
  backends?: Array<{ backend: string; status?: string; qubits?: number; average_queue_time?: number; degraded?: boolean }>;
  jobs?: ZeroThinkQuantumJob[]; job?: ZeroThinkQuantumJob; jobId?: string; cost?: unknown; cancellation?: unknown;
  estimate?: { estimated_total_cost: number; estimated_unit: string; estimated_at?: string; [key: string]: unknown };
  approvalToken?: string; estimateExpiresAt?: string; circuitFingerprint?: string; artifactId?: string; artifactFormat?: string;
}
interface ZeroThinkQuantumBridge { quantumZeroThinkRequest(request: ZeroThinkQuantumRequest): Promise<ZeroThinkQuantumResult> }
interface ZeroThinkIBMRequest { action: "backends" | "status"; instanceCRN: string; region: "us-east" | "eu-de"; backend?: string }
interface ZeroThinkIBMResult {
  provider: "ibm"; action: "backends" | "status"; apiVersion: string; region: string; recordedAt: string; provenance: string; warnings: string[];
  backends?: Array<{ name: string; status: string; reason?: string; qubits?: number; physical_qubits?: number; queue_length?: number; wait_time_seconds?: number; isSimulator?: boolean }>;
  backend?: string; status?: { status: string; message: string; available?: boolean; queueLength?: number; backendVersion?: string };
}
interface ZeroThinkIBMBridge { quantumZeroThinkIBM(request: ZeroThinkIBMRequest): Promise<ZeroThinkIBMResult> }
