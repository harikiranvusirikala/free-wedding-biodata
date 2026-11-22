import { photoPageGroups } from "@/biodata/photo-pages";
import type { DocModel } from "@/biodata/document";
import type { PagePicture, PhotoPagesInput } from "./blocks/types";
import { Page } from "./Page";
import { chartPlacement, contentSize, photoPageCells, type Cell } from "./photo-pages";
import { getPalette, getTemplate } from "./templates";

// The pages after the biodata (Step 4.2b, VISION D40, D41): photo pages and the horoscope chart's page, each a real
// A4 `Page` in the design's own frame, paper and margins (so the Modern panel and every frame carry on), without the
// top element and without the biodata's headings. Their numbers continue the biodata's. They are not measured or
// paginated: their layout is arithmetic (photo-pages.ts), so the biodata's page count, Auto text size and relaxed
// spacing are decided on the details alone, exactly as without them. The pictures are drawn upright at the cell's
// frame already (src/lib/document-photo.ts), so `object-fit: cover` is a no-op that the display list keeps for the
// rounded corner clip; the chart's box is its fitted size, so its corners follow the picture.

function Picture({ picture, cell, radius, fit }: { picture: PagePicture; cell: Cell; radius: number; fit: "cover" | "fill" }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- a local blob: URL, drawn at true size
    <img
      src={picture.src}
      alt=""
      width={cell.width}
      height={cell.height}
      draggable={false}
      style={{ position: "absolute", left: cell.x, top: cell.y, display: "block", width: cell.width, height: cell.height, objectFit: fit, borderRadius: radius }}
    />
  );
}

export function PhotoPageSet({ input, doc, firstNumber, bodyPx }: { input: PhotoPagesInput; doc: DocModel; firstNumber: number; bodyPx: number }) {
  const template = getTemplate(doc.templateId);
  const palette = getPalette(template, doc.colorId);
  const box = template.pageBox(1, doc);
  const content = contentSize(box);
  const radius = template.photoRadius ?? 10;
  const groups = photoPageGroups(input.photos, input.perPage);
  const page = (number: number, kind: string, children: React.ReactNode) => (
    <Page key={`${kind}-${number}`} number={number} lang={doc.lang} palette={palette} Frame={template.Frame} box={box} bodyPx={bodyPx}>
      <div data-extra-page={kind} style={{ position: "relative", flex: 1 }}>
        {children}
      </div>
    </Page>
  );
  return (
    <>
      {groups.map((group, g) =>
        page(
          firstNumber + g,
          "photos",
          photoPageCells(content, input.perPage, group.length).map((cell, i) => {
            const photo = group[i];
            return photo.picture ? <Picture key={photo.id} picture={photo.picture} cell={cell} radius={radius} fit="cover" /> : null;
          }),
        ),
      )}
      {input.chart
        ? page(
            firstNumber + groups.length,
            "chart",
            <>
              <div style={{ position: "absolute", left: 0, right: 0, top: 0 }}>
                <template.BlockView block={{ kind: "heading", id: "chart:heading", title: input.chart.title }} doc={doc} palette={palette} />
              </div>
              {input.chart.picture ? <Picture picture={input.chart.picture} cell={chartPlacement(content, input.chart.picture)} radius={radius} fit="fill" /> : null}
            </>,
          )
        : null}
    </>
  );
}
