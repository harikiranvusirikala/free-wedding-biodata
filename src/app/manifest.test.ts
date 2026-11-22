import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import manifest from "./manifest";

// The web app manifest (Step 5.2): the installed app opens the editor, and every icon it names exists.

describe("manifest", () => {
  const m = manifest();

  it("opens the editor as a standalone app", () => {
    expect(m.start_url).toBe("/editor");
    expect(m.id).toBe("/editor");
    expect(m.scope).toBe("/");
    expect(m.display).toBe("standalone");
    expect(m.name).toBe("Free Wedding Biodata");
    expect(m.short_name!.length).toBeLessThanOrEqual(12); // home screens cut longer names
  });

  it("names icons that npm run images made, including a maskable one", () => {
    expect(m.icons?.length).toBeGreaterThan(0);
    for (const icon of m.icons!) expect(existsSync(join("public", icon.src)), icon.src).toBe(true);
    expect(m.icons!.some((icon) => icon.purpose === "maskable")).toBe(true);
    expect(m.icons!.some((icon) => icon.sizes === "512x512" && icon.purpose === "any")).toBe(true);
  });

  it("uses the Day page colour and the brand colour", () => {
    expect(m.background_color).toBe("#fafaf9");
    expect(m.theme_color).toBe("#8a1c2b");
  });
});
