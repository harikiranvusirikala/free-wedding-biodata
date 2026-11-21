import { Fragment } from "react";

/**
 * App text with <b>bold</b> parts (src/i18n/app/en.json), turned into React elements: the dictionary never
 * becomes HTML, so nothing in it can run. Only <b> is understood; anything else stays as written.
 */
export function Rich({ text }: { text: string }) {
  return text.split(/(<b>.*?<\/b>)/).map((part, i) => {
    const bold = /^<b>(.*)<\/b>$/.exec(part);
    return bold ? <b key={i}>{bold[1]}</b> : <Fragment key={i}>{part}</Fragment>;
  });
}
