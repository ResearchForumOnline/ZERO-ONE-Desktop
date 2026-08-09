export type ServiceId = "zmail" | "zerothink" | "openzero" | "callchat";

export interface ServiceDefinition {
  id: ServiceId;
  name: string;
  eyebrow: string;
  description: string;
  accent: string;
  glyph: string;
  capabilities: string[];
  settingKey: "zmailUrl" | "zeroThinkUrl" | "openZeroUrl" | "callChatUrl";
}

export const SERVICES: ServiceDefinition[] = [
  {
    id: "openzero",
    name: "OpenZero",
    eyebrow: "FULL RUNTIME PANEL",
    description: "The full OpenZero panel for models, runs, tools, voice, automation, and Tab Pilot controls.",
    accent: "#00ff85",
    glyph: "Ø",
    capabilities: ["Full panel", "Runs & tools", "Tab Pilot"],
    settingKey: "openZeroUrl",
  },
  {
    id: "zerothink",
    name: "ZeroThink",
    eyebrow: "COGNITIVE STUDIO",
    description: "Research, reasoning, model routing, quantum workflows, and durable memory.",
    accent: "#a970ff",
    glyph: "∞",
    capabilities: ["Research", "Quantum", "Knowledge"],
    settingKey: "zeroThinkUrl",
  },
  {
    id: "zmail",
    name: "ZMail",
    eyebrow: "SECURE COMMUNICATION",
    description: "Mail, encrypted messages, signatures, campaigns, files, and team workflows.",
    accent: "#20c8ff",
    glyph: "Z",
    capabilities: ["Inbox", "ZMath Shield", "zSign"],
    settingKey: "zmailUrl",
  },
  {
    id: "callchat",
    name: "CallChat",
    eyebrow: "REAL-TIME PRESENCE",
    description: "Voice, video, private calling, meetings, and AI-assisted conversations.",
    accent: "#ff4fd8",
    glyph: "C",
    capabilities: ["Voice", "Video", "Live agent"],
    settingKey: "callChatUrl",
  },
];

export function serviceById(id: ServiceId) {
  return SERVICES.find((service) => service.id === id)!;
}

export function serviceIdFromView(view: string): ServiceId | null {
  const match = /^service:(openzero|zerothink|zmail|callchat)$/.exec(view);
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
