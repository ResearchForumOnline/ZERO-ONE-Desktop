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
    eyebrow: "CONFIGURED INTELLIGENCE",
    description: "Your configured OpenZero model endpoint, runs, tools, voice, and browser control.",
    accent: "#00ff85",
    glyph: "Ø",
    capabilities: ["Configured model", "16 slots", "Tool runtime"],
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

export function serviceUrl(service: ServiceDefinition, settings: ZeroOneSettings) {
  return settings[service.settingKey];
}
