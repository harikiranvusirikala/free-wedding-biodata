import { describe, expect, it } from "vitest";
import { faceSuffix, faceWeight } from "./weights";

describe("faceWeight", () => {
  it("matches a CSS weight to the shipped face as the browser does", () => {
    expect([100, 300, 400].map(faceWeight)).toEqual([400, 400, 400]);
    expect([450, 500].map(faceWeight)).toEqual([500, 500]);
    expect([550, 600, 700, 900].map(faceWeight)).toEqual([700, 700, 700, 700]);
  });

  it("names the face's file", () => {
    expect([400, 500, 700].map(faceSuffix)).toEqual(["Regular", "Medium", "Bold"]);
  });
});
