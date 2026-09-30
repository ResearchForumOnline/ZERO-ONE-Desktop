export type ServiceId = "openzero";

export interface ServiceDefinition {
  id: ServiceId;
  name: string;
  eyebrow: string;
  description: string;
  accent: string;
  glyph: string;
  capabilities: string[];
  settingKey: "openZeroUrl";
}

export const SERVICES: ServiceDefinition[] = [
  {
    id: "openzero",
    name: "OpenZero",
    eyebrow: "FULL RUNTIME PANEL",
    description: "The full OpenZero panel for models, runs, tools, persistent recursive coding, voice, automation, and Tab Pilot controls.",
    accent: "#00ff85",
    glyph: "Ø",
    capabilities: ["Full panel", "Runs & tools", "Recursive Lab", "Tab Pilot"],
    settingKey: "openZeroUrl",
  },

];

export function serviceById(id: ServiceId) {
  return SERVICES.find((service) => service.id === id)!;
}

export function serviceIdFromView(view: string): ServiceId | null {
  const match = /^service:(openzero)$/.exec(view);
  return match ? match[1] as ServiceId : null;
}

export function retainMountedServiceTab(current: readonly ServiceId[], next: ServiceId | null) {
  if (!next || current.includes(next)) return current;
  // SERVICES is the complete allowlist. This prevents arbitrary or unbounded
  // guest webContents from accumulating while preserving every owned tab.
  return [...current, next].slice(-SERVICES.length);
}

export function serviceUrl(service: ServiceDefinition, settings: ZeroOneSettings) {
  return settings[service.settingKey];
}
