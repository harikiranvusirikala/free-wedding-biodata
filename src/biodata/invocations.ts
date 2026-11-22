// The invocation lines offered at the top of a biodata (VISION §7 D21, Step 2.0): the lines families commonly
// print above everything, grouped by tradition. All optional: the picker starts at None and nothing is ever
// inferred from the Religion field. A picked line is copied into the draft as text (`options.invocation`), so it
// can be edited and is printed exactly as shown; this list only saves typing. Lines are printed in their own script
// whatever the document language is (a mantra isn't translated), so their text lives here rather than in the
// document dictionaries; the editor's English description of each one is in the app dictionary (top.line.<id>).

export const INVOCATION_GROUPS = ["hindu", "muslim", "christian", "sikh", "jain", "general"] as const;
export type InvocationGroup = (typeof INVOCATION_GROUPS)[number];

export interface Invocation {
  /** Stable id: the app dictionary describes the line under `top.line.<id>`. */
  id: string;
  group: InvocationGroup;
  text: string;
}

export const INVOCATIONS: readonly Invocation[] = [
  { id: "shriGaneshaya", group: "hindu", text: "॥ श्री गणेशाय नमः ॥" },
  { id: "shreeGaneshayaLatin", group: "hindu", text: "|| Shree Ganeshaya Namah ||" },
  { id: "om", group: "hindu", text: "ॐ" },
  { id: "shree", group: "hindu", text: "|| Shree ||" },
  { id: "teluguBlessing", group: "hindu", text: "శ్రీరస్తు · శుభమస్తు · అవిఘ్నమస్తు" },
  { id: "pillaiyarSuzhi", group: "hindu", text: "உ" },
  { id: "bismillah", group: "muslim", text: "Bismillah ir-Rahman ir-Rahim" },
  { id: "mark109", group: "christian", text: "What God has joined together, let no one separate. (Mark 10:9)" },
  { id: "ikOnkar", group: "sikh", text: "ੴ ਸਤਿ ਗੁਰ ਪ੍ਰਸਾਦਿ" },
  { id: "navkar", group: "jain", text: "॥ णमो अरिहंताणं ॥" },
  { id: "godsBlessings", group: "general", text: "With God's blessings" },
  { id: "eldersBlessings", group: "general", text: "With the blessings of our elders" },
];

/** The preset whose text this is (ignoring spaces at the ends), if any: the picker shows it as chosen. */
export function findInvocation(text: string): Invocation | undefined {
  const typed = text.trim();
  return typed ? INVOCATIONS.find((line) => line.text === typed) : undefined;
}

/** The title presets, in picker order: keys of `titles` in the document dictionaries (D45). */
export const TITLE_KEYS = ["biodata", "marriageBiodata", "bioData"] as const;
