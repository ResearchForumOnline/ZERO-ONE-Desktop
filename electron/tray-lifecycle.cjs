function shouldStartHidden(argv = []) {
  return argv.includes("--hidden");
}

function shouldCloseToTray({ isQuitting, closeToTray }) {
  return !isQuitting && Boolean(closeToTray);
}

function loginItemOptions({ enabled, executablePath, packaged }) {
  return {
    openAtLogin: Boolean(enabled),
    path: executablePath,
    args: enabled && packaged ? ["--hidden"] : [],
  };
}

module.exports = { loginItemOptions, shouldCloseToTray, shouldStartHidden };
