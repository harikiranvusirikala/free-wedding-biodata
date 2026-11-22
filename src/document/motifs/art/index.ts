// The owner's symbol artwork (drawn by a friend for this project, docs/references/icons): line drawings recoloured
// gold (scripts/motif-art.mts), the Ganesha and Om pictures, and the symbols from their sheet (scripts/motif-sheet.mts).
// Pictures are imported as files, so Next gives each a URL; the PDF writer fetches them when it prints. Colour
// pictures (the deity and Ganesha illustrations) keep their own colours: the document colour doesn't apply to them.
// The gold ones are recoloured in the design's colours in the browser (../tone.ts, ../tinted.ts); the files stay
// exactly as they are.
import ganeshaLine from "./ganesha-line.png";
import ganeshaOutline from "./ganesha-outline.png";
import ganeshaStencil from "./ganesha-stencil.png";
import ganeshaSeated from "./ganesha-seated.jpg";
import ganeshaTrident from "./ganesha-trident.png";
import ganeshaLotusFrame from "./ganesha-lotus-frame.png";
import ganeshaOrangeFrame from "./ganesha-orange-frame.png";
import ganeshaNamah from "./ganesha-namah.png";
import omMandala from "./om-mandala.png";
import omSeal from "./om-orange-seal.png";
import venkateswara from "./venkateswara.png";
import ramaWithBow from "./rama-with-bow.png";
import allahWreath from "./allah-wreath.png";
import ganeshaSeatedRight from "./ganesha-seated-right.png";
import ganeshaSeatedLeft from "./ganesha-seated-left.png";
import ganeshaMandala from "./ganesha-mandala.png";
import ganeshaLotus from "./ganesha-lotus.png";
import ganeshaThrone from "./ganesha-throne.png";
import ganeshaTrunk from "./ganesha-trunk.png";
import jainHand from "./jain-hand.png";
import omGold from "./om-gold.png";
import ganeshaSheet from "./ganesha-sheet.png";
import ikOnkarDisc from "./ik-onkar-disc.png";
import khandaSheet from "./khanda.png";
import crossLatinSheet from "./cross-latin.png";
import crossBuddedSheet from "./cross-budded.png";
import allahMedallionSheet from "./allah-medallion.png";
import dharmaLight from "./dharma-light.png";
import dharmaSolid from "./dharma-solid.png";
import jainMotto from "./jain-motto.png";

// Next gives an image import as { src, … }; other tools (the unit tests) give the path itself.
const url = (image: string | { src: string }): string => (typeof image === "string" ? image : image.src);

export const ART = {
  ganeshaLine: url(ganeshaLine),
  ganeshaOutline: url(ganeshaOutline),
  ganeshaStencil: url(ganeshaStencil),
  ganeshaSeated: url(ganeshaSeated),
  ganeshaTrident: url(ganeshaTrident),
  ganeshaLotusFrame: url(ganeshaLotusFrame),
  ganeshaOrangeFrame: url(ganeshaOrangeFrame),
  ganeshaNamah: url(ganeshaNamah),
  omMandala: url(omMandala),
  omSeal: url(omSeal),
  venkateswara: url(venkateswara),
  ramaWithBow: url(ramaWithBow),
  allahWreath: url(allahWreath),
  ganeshaSeatedRight: url(ganeshaSeatedRight),
  ganeshaSeatedLeft: url(ganeshaSeatedLeft),
  ganeshaMandala: url(ganeshaMandala),
  ganeshaLotus: url(ganeshaLotus),
  ganeshaThrone: url(ganeshaThrone),
  ganeshaTrunk: url(ganeshaTrunk),
  jainHand: url(jainHand),
  omGold: url(omGold),
  ganeshaSheet: url(ganeshaSheet),
  ikOnkarDisc: url(ikOnkarDisc),
  khandaSheet: url(khandaSheet),
  crossLatinSheet: url(crossLatinSheet),
  crossBuddedSheet: url(crossBuddedSheet),
  allahMedallionSheet: url(allahMedallionSheet),
  dharmaLight: url(dharmaLight),
  dharmaSolid: url(dharmaSolid),
  jainMotto: url(jainMotto),
} as const;
