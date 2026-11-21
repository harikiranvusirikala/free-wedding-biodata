// A tiny XML reader for the machine-generated SVG in the display list (DOMParser isn't available in Node).
// Handles elements, attributes (single or double quotes), self-closing tags, text, comments, CDATA, <?…?> and
// <!DOCTYPE …>. Entities: the five predefined ones and numeric character references.

export interface XmlElement {
  name: string;
  attrs: Record<string, string>;
  children: XmlElement[];
  text: string;
}

const decode = (s: string) =>
  s.replace(/&(#x[0-9a-fA-F]+|#\d+|lt|gt|amp|quot|apos);/g, (_, e: string) => {
    if (e[0] === "#") return String.fromCodePoint(e[1] === "x" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10));
    return ({ lt: "<", gt: ">", amp: "&", quot: '"', apos: "'" } as Record<string, string>)[e];
  });

/** Parses markup and returns the root element. Throws on markup it can't read. */
export function parseXml(markup: string): XmlElement {
  const root: XmlElement = { name: "#root", attrs: {}, children: [], text: "" };
  const stack: XmlElement[] = [root];
  let i = 0;
  const n = markup.length;
  while (i < n) {
    const lt = markup.indexOf("<", i);
    if (lt < 0) {
      stack[stack.length - 1].text += decode(markup.slice(i));
      break;
    }
    if (lt > i) stack[stack.length - 1].text += decode(markup.slice(i, lt));
    if (markup.startsWith("<!--", lt)) {
      const end = markup.indexOf("-->", lt + 4);
      i = end < 0 ? n : end + 3;
      continue;
    }
    if (markup.startsWith("<![CDATA[", lt)) {
      const end = markup.indexOf("]]>", lt + 9);
      stack[stack.length - 1].text += markup.slice(lt + 9, end < 0 ? n : end);
      i = end < 0 ? n : end + 3;
      continue;
    }
    if (markup[lt + 1] === "?" || markup[lt + 1] === "!") {
      const end = markup.indexOf(">", lt);
      i = end < 0 ? n : end + 1;
      continue;
    }
    if (markup[lt + 1] === "/") {
      const end = markup.indexOf(">", lt);
      const name = markup.slice(lt + 2, end).trim();
      const top = stack.pop();
      if (!top || top.name !== name) throw new Error(`Unexpected </${name}>`);
      i = end + 1;
      continue;
    }
    // Start tag.
    let j = lt + 1;
    while (j < n && !/[\s/>]/.test(markup[j])) j++;
    const el: XmlElement = { name: markup.slice(lt + 1, j), attrs: {}, children: [], text: "" };
    let selfClosing = false;
    for (;;) {
      while (j < n && /\s/.test(markup[j])) j++;
      if (j >= n) throw new Error(`Unterminated <${el.name}>`);
      if (markup[j] === ">") {
        j++;
        break;
      }
      if (markup[j] === "/" && markup[j + 1] === ">") {
        selfClosing = true;
        j += 2;
        break;
      }
      const nameStart = j;
      while (j < n && !/[\s=/>]/.test(markup[j])) j++;
      const attr = markup.slice(nameStart, j);
      while (j < n && /\s/.test(markup[j])) j++;
      if (markup[j] !== "=") {
        el.attrs[attr] = "";
        continue;
      }
      j++;
      while (j < n && /\s/.test(markup[j])) j++;
      const quote = markup[j];
      if (quote === '"' || quote === "'") {
        const end = markup.indexOf(quote, j + 1);
        if (end < 0) throw new Error(`Unterminated attribute ${attr}`);
        el.attrs[attr] = decode(markup.slice(j + 1, end));
        j = end + 1;
      } else {
        const start = j;
        while (j < n && !/[\s>]/.test(markup[j])) j++;
        el.attrs[attr] = decode(markup.slice(start, j));
      }
    }
    stack[stack.length - 1].children.push(el);
    if (!selfClosing) stack.push(el);
    i = j;
  }
  if (stack.length !== 1) throw new Error(`Unclosed <${stack[stack.length - 1].name}>`);
  const svg = root.children[0];
  if (!svg) throw new Error("No root element");
  return svg;
}
