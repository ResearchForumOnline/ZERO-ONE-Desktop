type ZeroThinkVaultProvider = "groq" | "openai" | "gemini" | "anthropic" | "xai" | "nvidia" | "featherless" | "openzero" | "serper" | "ionq" | "ibm";
interface ZeroThinkVaultProviderInfo { id: ZeroThinkVaultProvider; label: string; kind: "chat" | "search" | "quantum"; endpoint: string; defaultModel: string; requiresKey: boolean }
interface ZeroThinkVaultProfile { id: string; name: string; provider: ZeroThinkVaultProvider; kind: "chat" | "search" | "quantum"; model: string; endpoint: string; hasKey: boolean; updatedAt: string }
interface ZeroThinkVaultSnapshot { version: 1; secure: boolean; activeProfileId: string | null; profiles: ZeroThinkVaultProfile[]; providers: ZeroThinkVaultProviderInfo[]; message: string }
interface ZeroThinkVaultProfileInput { id?: string; name: string; provider: ZeroThinkVaultProvider; model?: string; endpoint?: string; key?: string; clearKey?: boolean }
interface ZeroThinkVaultAPI {
  getZeroThinkVault(): Promise<ZeroThinkVaultSnapshot>;
  saveZeroThinkVaultProfile(input: ZeroThinkVaultProfileInput): Promise<ZeroThinkVaultSnapshot>;
  deleteZeroThinkVaultProfile(id: string): Promise<ZeroThinkVaultSnapshot>;
  selectZeroThinkVaultProfile(id: string | null): Promise<ZeroThinkVaultSnapshot>;
}
