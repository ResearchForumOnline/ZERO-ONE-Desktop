import { describe, expect, it } from "vitest";
import { SERVICES, serviceById } from "./services";

describe("service catalog", () => {
  it("contains each ZERO ONE workspace exactly once", () => {
    expect(SERVICES.map((service) => service.id).sort()).toEqual(["callchat", "openzero", "zerothink", "zmail"]);
  });

  it("keeps OpenZero as the local-first runtime", () => {
    expect(serviceById("openzero").capabilities).toContain("Local LLM");
    expect(serviceById("openzero").capabilities).toContain("16 agents");
  });
});
