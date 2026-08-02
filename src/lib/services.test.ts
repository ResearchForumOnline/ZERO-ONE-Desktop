import { describe, expect, it } from "vitest";
import { SERVICES, serviceById } from "./services";

describe("service catalog", () => {
  it("contains each ZERO ONE workspace exactly once", () => {
    expect(SERVICES.map((service) => service.id).sort()).toEqual(["callchat", "openzero", "zerothink", "zmail"]);
  });

  it("describes OpenZero as a configured endpoint without inventing pool telemetry", () => {
    expect(serviceById("openzero").capabilities).toContain("Configured model");
    expect(serviceById("openzero").capabilities).toContain("16 slots");
  });
});
