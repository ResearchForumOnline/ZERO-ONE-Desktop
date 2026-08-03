const { app, safeStorage } = require("electron");
const fs = require("node:fs/promises");
const path = require("node:path");

const userData = path.join(process.env.APPDATA || "", "zero-one-desktop");
app.setPath("userData", userData);

app.whenReady().then(async () => {
  let token = "";
  try {
    const settings = JSON.parse(await fs.readFile(path.join(userData, "zero-one-settings.json"), "utf8"));
    token = safeStorage.decryptString(Buffer.from(settings.openZeroTokenEncrypted, "base64"));
    const response = await fetch("http://127.0.0.1:1024/v1/models", {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json", "User-Agent": "ZERO-ONE-Credential-Verification" },
    });
    const payload = await response.json().catch(() => ({}));
    const models = Array.isArray(payload.data) ? payload.data.map((entry) => String(entry.id || "")).filter(Boolean) : [];
    process.stdout.write(JSON.stringify({ authenticated: response.ok, status: response.status, models, defaultAvailable: models.includes("openzerogemma:latest") }));
    if (!response.ok) process.exitCode = 1;
  } catch (error) {
    process.stdout.write(JSON.stringify({ authenticated: false, error: error instanceof Error ? error.message : "Credential verification failed" }));
    process.exitCode = 1;
  } finally {
    token = "";
    app.quit();
  }
});
