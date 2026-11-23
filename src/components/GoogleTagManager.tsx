/**
 * Google Tag Manager's two snippets, as Tag Manager gives them (Admin → Install Google Tag Manager), for the container
 * `id` from gtmId() (production only), or nothing without one. Only the public pages' layout draws them (VISION D22):
 * the editor, where people type their details, loads nothing from another site. Google asks for the script high in
 * <head> and the frame right after <body>; only the root layout owns <head> and it is shared with the editor, so the
 * public layout puts both first in its part of <body>.
 */
export function GoogleTagManager({ id }: { id: string | undefined }) {
  if (!id) return null;
  return (
    <>
      {/* Runs on a full page load only: React never runs a script it adds while navigating. */}
      <script dangerouslySetInnerHTML={{ __html: tagManagerScript(id) }} />
      {/* For visitors without JavaScript. */}
      <noscript>
        <iframe src={`https://www.googletagmanager.com/ns.html?id=${id}`} height="0" width="0" style={{ display: "none", visibility: "hidden" }} />
      </noscript>
    </>
  );
}

/** Google's script word for word, apart from the ID, which is written in as a JavaScript string. */
function tagManagerScript(id: string) {
  return `(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
})(window,document,'script','dataLayer',${JSON.stringify(id)});`;
}
