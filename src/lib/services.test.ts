import { describe, expect, it } from "vitest";
import { SERVICES, retainMountedServiceTab, serviceById, serviceIdFromView } from "./services";

describe("service catalog", () => {
  it("contains each ZERO ONE workspace exactly once", () => {
    expect(SERVICES.map((service) => service.id).sort()).toEqual(["callchat", "openzero", "zerothink", "zmail"]);
  });

  it("describes OpenZero as the full runtime panel without inventing pool telemetry", () => {
    expect(serviceById("openzero").capabilities).toContain("Full panel");
    expect(serviceById("openzero").capabilities).toContain("Runs & tools");
    expect(serviceById("openzero").capabilities).toContain("Recursive Lab");
    expect(serviceById("openzero").capabilities).toContain("Tab Pilot");
  });

  it("keeps opened workspace tabs mounted without exceeding the service allowlist", () => {
    let mounted: readonly (typeof SERVICES)[number]["id"][] = [];
    for (const service of SERVICES) mounted = retainMountedServiceTab(mounted, service.id);

    expect(mounted).toEqual(SERVICES.map((service) => service.id));
    expect(retainMountedServiceTab(mounted, "zmail")).toBe(mounted);
    expect(retainMountedServiceTab(mounted, null)).toBe(mounted);
  });

  it("recognizes only the four owned workspace views", () => {
    expect(serviceIdFromView("service:zmail")).toBe("zmail");
    expect(serviceIdFromView("service:openzero")).toBe("openzero");
    expect(serviceIdFromView("service:unknown")).toBeNull();
    expect(serviceIdFromView("settings")).toBeNull();
  });
});
