import { homedir } from "node:os";
import { type FlagSpec, parseCommandArgs } from "../args.js";
import { launchBrowser } from "../browser.js";
import { fail } from "../errors.js";
import { downloadEngine, engineAsset, ENGINE_VERSION, findImpeccable } from "../impeccable.js";
import type { Runtime } from "../runtime.js";

export const SETUP_HELP = `usage: design-kit setup [--download] [--no-browser]
description: Make the gate run fully on this machine: find a browser and the Impeccable engine; when the engine is missing, download the pinned version (${ENGINE_VERSION}, about 20 MB) from github.com/pbakaus/impeccable releases into ~/.design-kit (or DK_HOME) and verify its sha256 before installing it. Without the engine the gate still runs and marks Impeccable "skipped"
flags[2]:
  --download: download the pinned engine even when one is already found (into the design-kit cache)
  --no-browser: skip the browser check
notes[2]:
  Engine search order: IMPECCABLE_BIN, the impeccable skill's bundled binary, ~/.impeccable/bin/<version>, ~/.design-kit/impeccable/<version>
  Browser order: DK_BROWSER, Edge, Chrome, Playwright's Chromium (\`npx playwright install chromium\`)
`;

const FLAGS: Record<string, FlagSpec> = {
  download: { type: "boolean", hint: "--download" },
  "no-browser": { type: "boolean", hint: "--no-browser" },
};

export async function setupCommand(args: string[], rt: Runtime): Promise<Record<string, unknown>> {
  const p = parseCommandArgs("setup", args, FLAGS);
  const tilde = (s: string) => (s.toLowerCase().startsWith(homedir().toLowerCase()) ? `~${s.slice(homedir().length).replace(/\\/g, "/")}` : s);
  const out: Record<string, unknown> = {};
  let engine = p.bool("download") ? undefined : findImpeccable(rt.env);
  if (engine) out["impeccable"] = `found: ${tilde(engine)}`;
  else {
    try {
      const d = await downloadEngine(rt.env);
      engine = d.path;
      out["impeccable"] = `downloaded ${engineAsset()} ${ENGINE_VERSION} (${(d.bytes / 1048576).toFixed(1)} MB, sha256 verified) to ${tilde(d.path)}`;
    } catch (e) {
      fail(`impeccable: ${(e as Error).message}`, "IO_ERROR", [
        "Check the network, or set IMPECCABLE_BIN to an engine binary",
        "The gate still runs without it: Impeccable is reported as skipped",
      ]);
    }
  }
  if (!p.bool("no-browser")) {
    const { browser, via } = await launchBrowser(rt.env);
    await browser.close();
    out["browser"] = via;
  }
  return {
    status: "ready: the gate can run every check on this machine",
    ...out,
    help: ["Run `design-kit check <file|dir|url> --strict`"],
  };
}
