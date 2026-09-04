"use strict";

const packageMetadata = require("../package.json");
const storeIdentity = require("./store-identity.json");

function requiredStoreField(name, fallback, pattern) {
  const value = String(process.env[name] || fallback || "").trim();
  if (!value || /COPY_|PLACEHOLDER/i.test(value) || (pattern && !pattern.test(value))) {
    throw new Error(`${name} must be copied exactly from Partner Center Product identity.`);
  }
  return value;
}

const identityName = requiredStoreField("ZERO_ONE_STORE_IDENTITY_NAME", storeIdentity.identityName, /^[A-Za-z0-9.-]{3,50}$/);
const publisher = requiredStoreField("ZERO_ONE_STORE_PUBLISHER", storeIdentity.publisher, /^.{3,200}$/);
const publisherDisplayName = requiredStoreField("ZERO_ONE_STORE_PUBLISHER_DISPLAY_NAME", storeIdentity.publisherDisplayName, /^.{1,256}$/);

module.exports = {
  ...packageMetadata.build,
  directories: {
    ...packageMetadata.build.directories,
    output: "release/store",
  },
  win: {
    ...packageMetadata.build.win,
    target: [{ target: "appx", arch: ["x64"] }],
  },
  appx: {
    applicationId: "ZeroOneDesktop",
    identityName,
    publisher,
    publisherDisplayName,
    displayName: "ZERO ONE Desktop",
    languages: ["en-GB"],
    capabilities: ["runFullTrust"],
    minVersion: "10.0.17763.0",
      maxVersionTested: "10.0.26200.0",
    setBuildNumber: false,
    showNameOnTiles: true,
    electronUpdaterAware: false,
    backgroundColor: "transparent",
  },
};
