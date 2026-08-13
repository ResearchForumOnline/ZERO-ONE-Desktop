/// <reference types="vite/client" />

interface ZeroOneSettings {
  zmailUrl: string;
  zeroThinkUrl: string;
  openZeroUrl: string;
  openZeroPublicUrl: string;
  callChatUrl: string;
  assistantProvider: "openzero" | "openai" | "groq";
  model: string;
  openZeroServerModel: string;
  openZeroAssistantMode: "local" | "server";
  localResourceProfile: "low-memory" | "balanced" | "performance";
  mediaEnabled: boolean;
  launchAtLogin: boolean;
  closeToTray: boolean;
  onboardingCompleted: boolean;
  lastView?: string;
  lastCopilotOpen?: boolean;
  hasOpenZeroToken: boolean;
  hasOpenAiKey: boolean;
  hasGroqKey: boolean;
  hasZeroThinkAccount: boolean;
  zeroThinkEmail?: string;
  openZeroToken?: string;
  openAiKey?: string;
  groqKey?: string;
  clearOpenZeroToken?: boolean;
  clearOpenAiKey?: boolean;
  clearGroqKey?: boolean;
}

interface ZsecSnapshot {
  installed: boolean;
  state: "idle" | "ready" | "attention" | "not-installed" | "unavailable";
  version?: string;
  platform: string;
  definitions?: string;
  lastScan?: string;
  outcome?: "no_configured_rule_matches" | "configured_rule_matches_detected" | "incomplete";
  findings?: number;
  errors?: number;
  filesHashed?: number;
  bytesHashed?: number;
  quarantine?: number;
  message: string;
}

interface ZsecScanResult {
  cancelled: boolean;
  outcome?: "no_configured_rule_matches" | "configured_rule_matches_detected" | "incomplete";
  filesHashed?: number;
  bytesHashed?: number;
  findings?: number;
  errors?: number;
  message: string;
}

interface ServiceProbe {
  name: string;
  state: "online" | "degraded" | "offline";
  status: number;
  latencyMs: number;
  url: string;
  message?: string;
}

interface SystemSnapshot {
  hostname: string;
  platform: string;
  cpu: string;
  cores: number;
  memoryTotal: number;
  memoryUsed: number;
  memoryPercent: number;
  uptimeSeconds: number;
}

interface ZmathSecurityStatus {
  transport: { state: "protected"; message: string };
  credentials: { state: "protected" | "unavailable"; message: string };
  disk: { state: "protected" | "off" | "unavailable" | "unsupported"; message: string; volumeStatus?: string; encryptionPercentage?: number };
  engine: { state: "interface-only"; message: string };
}

interface AppUpdateInfo {
  status: "available" | "current" | "unavailable";
  updateAvailable: boolean;
  currentVersion: string;
  latestVersion: string;
  releaseUrl: string;
  checkedAt: string;
}

interface Window {
  zeroOne: {
    getAppInfo(): Promise<{ name: string; version: string; platform: string; packaged: boolean }>;
    checkForAppUpdate(): Promise<AppUpdateInfo>;
    getUserInterfaceScale(): Promise<number>;
    setUserInterfaceScale(factor: number): Promise<number>;
    startZeroThinkSignIn(): Promise<{ status: string; email: string; userCode: string; url?: string }>;
    restoreZeroThinkSession(): Promise<{ status: string; email: string; url?: string; message?: string }>;
    signOutZeroThink(): Promise<boolean>;
    listSavedWorkspaceLogins?: () => Promise<Array<{ origin: string; username: string; updatedAt?: string }>>;
    getWorkspaceCredentialStatus?: () => Promise<{ available: boolean; backend?: string }>;
    deleteSavedWorkspaceLogin?: (origin: string) => Promise<boolean>;
    clearSavedWorkspaceLogins?: () => Promise<boolean>;
    keepZmailSessionAlive?: () => Promise<boolean>;
    quitApp(): Promise<boolean>;
    onAppNavigate(callback: (view: string) => void): () => void;
    getSystemSnapshot(): Promise<SystemSnapshot>;
    loadSettings(): Promise<ZeroOneSettings>;
    saveSettings(settings: Partial<ZeroOneSettings>): Promise<ZeroOneSettings>;
    clearLocalData(): Promise<{ cleared: boolean }>;
    probeServices(): Promise<ServiceProbe[]>;
    connectOpenZeroDesktop(): Promise<{ settings: ZeroOneSettings; hint: string; model: string; models: string[] }>;
    getLocalOpenZeroStatus?(): Promise<{ reachable: boolean; origin: string; defaultModel: string; version: string; models: Array<{ name: string; size: number; modifiedAt: string }>; runningModels: Array<{ name: string; size: number; expiresAt: string }>; message?: string }>;
    openOllamaDownload?(): Promise<boolean>;
    pullLocalOpenZeroModel?(model: string, onProgress: (progress: { status: string; completed: number; total: number; percent?: number; done: boolean }) => void): Promise<{ status: string }>;
    cancelLocalOpenZeroModelPull?(): Promise<{ cancelled: number }>;
    unloadLocalOpenZeroModels?(input: { model?: string; all?: boolean }): Promise<{ unloaded: number }>;
    chatLocalOpenZero?(request: { model?: string; messages: Array<{ role: "user" | "assistant"; content: string }> }): Promise<{ content: string; model: string }>;
    chat(request: { model: string; messages: Array<{ role: "user" | "assistant" | "system"; content: string }> }): Promise<{ content: string; model: string; provider?: string }>;
    openExternal(url: string): Promise<boolean>;
    exportDiagnostics(): Promise<{ saved: boolean; path?: string }>;
    getZsecStatus(): Promise<ZsecSnapshot>;
    scanWithZsec(): Promise<ZsecScanResult>;
    getZmathSecurityStatus(): Promise<ZmathSecurityStatus>;
    openDiskEncryptionSettings(): Promise<boolean>;
  };
}

declare namespace JSX {
  interface IntrinsicElements {
    webview: React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement> & {
      src?: string;
      partition?: string;
      allowpopups?: string;
    };
  }
}
