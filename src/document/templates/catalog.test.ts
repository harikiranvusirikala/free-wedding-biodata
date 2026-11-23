import { expect, it } from "vitest";
import { DESIGN_CATALOG } from "./catalog";
import { TEMPLATES } from "./index";

it("lists exactly the registry's designs, names, kinds and colours, in picker order", () => {
  expect(DESIGN_CATALOG).toEqual(TEMPLATES.map((t) => ({ id: t.id, name: t.name, skeleton: t.skeleton, colors: t.colors.map((c) => ({ id: c.id, name: c.name, swatch: c.swatch })) })));
});
