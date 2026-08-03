import { describe, expect, it } from "vitest";
import { SERVICES, serviceById } from "./services";

describe("service catalog", () => {
  it("contains each ZERO ONE workspace exactly once", () => {
    expect(SERVICES.map((service) => service.id).sort()).toEqual(["callchat", "openzero", "zerothink", "zmail"]);
  });

  it("describes OpenZero as the full runtime panel without inventing pool telemetry", () => {
    expect(serviceById("openzero").capabilities).toContain("Full panel");
    expect(serviceById("openzero").capabilities).toContain("Runs & tools");
    expect(serviceById("openzero").capabilities).toContain("Tab Pilot");
  });
});
