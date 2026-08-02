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
  findings?: number;
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

interface Window {
  zeroOne: {
    getAppInfo(): Promise<{ name: string; version: string; platform: string; packaged: boolean }>;
    getSystemSnapshot(): Promise<SystemSnapshot>;
    loadSettings(): Promise<ZeroOneSettings>;
    saveSettings(settings: Partial<ZeroOneSettings>): Promise<ZeroOneSettings>;
    probeServices(): Promise<ServiceProbe[]>;
    chat(request: { model: string; messages: Array<{ role: "user" | "assistant" | "system"; content: string }> }): Promise<{ content: string; model: string }>;
    openExternal(url: string): Promise<boolean>;
    exportDiagnostics(): Promise<{ saved: boolean; path?: string }>;
    getZsecStatus(): Promise<ZsecSnapshot>;
    scanWithZsec(): Promise<ZsecScanResult>;
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
