const path = require("node:path");
const { Arch } = require("builder-util");
const { verifyLocalRuntime } = require("./local-runtime-verifier.cjs");
const { flipFuses, FuseVersion, FuseV1Options } = require("@electron/fuses");

module.exports = async function afterPack(context) {
  const product = context.packager.appInfo.productFilename;
  const linuxExecutable = context.packager.executableName;
  const executable = context.electronPlatformName === "win32"
    ? path.join(context.appOutDir, `${product}.exe`)
    : context.electronPlatformName === "darwin"
      ? path.join(context.appOutDir, `${product}.app`, "Contents", "MacOS", product)
      : path.join(context.appOutDir, linuxExecutable);

  const resources = context.electronPlatformName === "darwin"
    ? path.join(context.appOutDir, `${product}.app`, "Contents", "Resources")
    : path.join(context.appOutDir, "resources");
  const runtime = verifyLocalRuntime(path.join(resources, "local-runtime"), `${context.electronPlatformName}-${Arch[context.arch]}`);
  process.stdout.write(`Verified packaged CPU runtime: ${runtime.platform} ${runtime.runtimeVersion}\n`);

  await flipFuses(executable, {
    version: FuseVersion.V1,
    strictlyRequireAllFuses: true,
    [FuseV1Options.RunAsNode]: false,
    [FuseV1Options.EnableCookieEncryption]: true,
    [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
    [FuseV1Options.EnableNodeCliInspectArguments]: false,
    [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: true,
    [FuseV1Options.OnlyLoadAppFromAsar]: true,
    [FuseV1Options.LoadBrowserProcessSpecificV8Snapshot]: false,
    [FuseV1Options.GrantFileProtocolExtraPrivileges]: true,
    [FuseV1Options.WasmTrapHandlers]: true,
  });
};
