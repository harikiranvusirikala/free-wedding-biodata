import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, test } from "vitest";
import { GTM_CONTAINER } from "@/lib/site";
import { GoogleTagManager } from "./GoogleTagManager";

// The owner's snippets, as Tag Manager gives them (Admin → Install Google Tag Manager).
const GOOGLE_SCRIPT = `(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
})(window,document,'script','dataLayer','GTM-KJ4DFJHW');`;
const GOOGLE_NOSCRIPT = `<noscript><iframe src="https://www.googletagmanager.com/ns.html?id=GTM-KJ4DFJHW" height="0" width="0" style="display:none;visibility:hidden"></iframe></noscript>`;

const script = () => {
  const html = renderToStaticMarkup(<GoogleTagManager id={GTM_CONTAINER} />);
  return html.slice("<script>".length, html.indexOf("</script>"));
};

// Drawn on the server, as the static export is: in the browser, React never draws inside <noscript>.
describe("Google Tag Manager's snippets (VISION D22)", () => {
  test("Google's script, then the frame for visitors without JavaScript; only the quotes around the ID differ", () => {
    expect(GTM_CONTAINER).toBe("GTM-KJ4DFJHW");
    expect(renderToStaticMarkup(<GoogleTagManager id={GTM_CONTAINER} />)).toBe(
      `<script>${GOOGLE_SCRIPT.replace("'GTM-KJ4DFJHW'", '"GTM-KJ4DFJHW"')}</script>${GOOGLE_NOSCRIPT}`,
    );
  });

  test("nothing without a container", () => {
    expect(renderToStaticMarkup(<GoogleTagManager id={undefined} />)).toBe("");
  });
});

// The script run in the page (jsdom loads no outside scripts, so nothing reaches Google).
describe("the script in the page", () => {
  afterEach(() => {
    document.head.innerHTML = "";
    delete (window as unknown as { dataLayer?: unknown }).dataLayer;
  });

  test("loads Tag Manager for the container, as Google's snippet does", () => {
    document.head.append(document.createElement("script")); // Google's script goes before the page's first one
    new Function(script())();
    expect(document.querySelector('script[src^="https://www.googletagmanager.com/gtm.js"]')?.getAttribute("src")).toBe("https://www.googletagmanager.com/gtm.js?id=GTM-KJ4DFJHW");
    expect((window as unknown as { dataLayer?: { event?: string }[] }).dataLayer?.[0]).toMatchObject({ event: "gtm.js" });
  });
});
