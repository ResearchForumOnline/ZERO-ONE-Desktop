/// <reference types="vite/client" />

interface ZeroOneSettings {
  zmailUrl: string;
  zeroThinkUrl: string;
  openZeroUrl: string;
  openZeroPublicUrl: string;
  callChatUrl: string;
  model: string;
  mediaEnabled: boolean;
  launchAtLogin: boolean;
  hasOpenZeroToken: boolean;
  openZeroToken?: string;
  clearOpenZeroToken?: boolean;
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

interface Window {
  zeroOne: {
    getAppInfo(): Promise<{ name: string; version: string; platform: string; packaged: boolean }>;
    getSystemSnapshot(): Promise<SystemSnapshot>;
    loadSettings(): Promise<ZeroOneSettings>;
    saveSettings(settings: Partial<ZeroOneSettings>): Promise<ZeroOneSettings>;
    clearLocalData(): Promise<{ cleared: boolean }>;
    probeServices(): Promise<ServiceProbe[]>;
    chat(request: { model: string; messages: Array<{ role: "user" | "assistant" | "system"; content: string }> }): Promise<{ content: string; model: string }>;
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
