const { app, safeStorage } = require("electron");
const fs = require("node:fs/promises");
const path = require("node:path");
const { cleanConfiguredUrl } = require("../electron/url-policy.cjs");
const DEFAULT_OPENZERO_SERVER_MODEL = "hf.co/shafire/OpenZero-Ministral3-8B-Runtime-Agent-GGUF:Q5_K_M";
const DEFAULT_OPENZERO_URL = "http://127.0.0.1:1024/";
const OPENZERO_ORIGINS = new Set(["https://openzero.talktoai.org", "http://127.0.0.1:1024", "http://localhost:1024"]);

const userData = path.join(process.env.APPDATA || "", "zero-one-desktop");
app.setPath("userData", userData);

app.whenReady().then(async () => {
  let token = "";
  try {
    const settings = JSON.parse(await fs.readFile(path.join(userData, "zero-one-settings.json"), "utf8"));
    token = safeStorage.decryptString(Buffer.from(settings.openZeroTokenEncrypted, "base64"));
    const endpoint = new URL("/v1/models", cleanConfiguredUrl(settings.openZeroUrl, DEFAULT_OPENZERO_URL, OPENZERO_ORIGINS));
    const response = await fetch(endpoint, {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json", "User-Agent": "ZERO-ONE-Credential-Verification" },
    });
    const payload = await response.json().catch(() => ({}));
    const models = Array.isArray(payload.data) ? payload.data.map((entry) => String(entry.id || "")).filter(Boolean) : [];
    const expectedModel = String(settings.openZeroServerModel || DEFAULT_OPENZERO_SERVER_MODEL);
    process.stdout.write(JSON.stringify({ authenticated: response.ok, status: response.status, models, expectedModel, defaultAvailable: models.includes(expectedModel) }));
    if (!response.ok) process.exitCode = 1;
  } catch (error) {
    process.stdout.write(JSON.stringify({ authenticated: false, error: error instanceof Error ? error.message : "Credential verification failed" }));
    process.exitCode = 1;
  } finally {
    token = "";
    app.quit();
  }
});
