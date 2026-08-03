const { app, safeStorage } = require("electron");
const fs = require("node:fs/promises");
const path = require("node:path");

const zeroOneUserData = path.join(process.env.APPDATA || "", "zero-one-desktop");
app.setPath("userData", zeroOneUserData);

app.whenReady().then(async () => {
  let token = "";
  try {
    const settingsPath = path.join(zeroOneUserData, "zero-one-settings.json");
    const settings = JSON.parse(await fs.readFile(settingsPath, "utf8"));
    token = safeStorage.decryptString(Buffer.from(settings.openZeroTokenEncrypted, "base64"));
    const response = await fetch("http://127.0.0.1:1024/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", "User-Agent": "ZERO-ONE-Release-Verification" },
      body: JSON.stringify({ model: settings.model || "openzerogemma:latest", messages: [{ role: "user", content: "Reply with exactly: ZERO ONE READY" }], temperature: 0.1, max_tokens: 24, stream: false }),
    });
    const payload = await response.json().catch(() => ({}));
    const content = String(payload?.choices?.[0]?.message?.content || "");
    process.stdout.write(JSON.stringify({ authenticated: response.ok, status: response.status, model: String(payload.model || ""), responseReceived: Boolean(content), expectedPhrase: /ZERO ONE READY/i.test(content) }));
  } catch (error) {
    process.stdout.write(JSON.stringify({ authenticated: false, error: error instanceof Error ? error.message : "Verification failed" }));
    process.exitCode = 1;
  } finally {
    token = "";
    app.quit();
  }
});
