// The PDF and Indian-script fixture (BUILD_PLAN Step 0.2, VISION §15). Every name, number and address is
// fictional (phone numbers in the unassigned 90000 range). Each language's values are chosen to stress text
// shaping: conjuncts and reph, vowel signs that sit before the consonant, ZWJ/ZWNJ, chillu letters, Indic and
// Latin digits, and English mixed into Indic text. Kept after the spike: Step 4.2 regenerates these PDFs.

export type LangCode = "en" | "te" | "hi" | "ta" | "kn" | "ml" | "mr" | "gu" | "bn" | "pa";

export interface FixtureSection {
  heading: string;
  rows: [label: string, value: string][];
}

export interface FixturePage {
  lang: LangCode;
  /** The language's English name, for reports. */
  language: string;
  /** The CSS font family that draws the script (public/fonts/, loaded by the spike page). */
  fontFamily: string;
  title: string;
  sections: FixtureSection[];
  /** Paragraphs under an "About" heading. */
  about?: { heading: string; paragraphs: string[] };
}

/** A 60-character name: long names must wrap or fit, never overflow. */
export const LONG_NAME = "Venkata Satya Sai Lakshmi Narasimha Teja Mandapati Ramakrishna";

/** A long address with a PIN code. */
export const LONG_ADDRESS =
  "Flat 402, Block C, Sample Residency, 3rd Cross, Behind the Old Water Tank, Near Fictional Temple, Sample Nagar Colony, Guntur, Andhra Pradesh – 522002, India";

const ABOUT_SENTENCES = [
  "I grew up in a joint family in Guntur, where Sunday lunches were long and loud and everyone had an opinion about cricket.",
  "After school I studied electronics at an engineering college in Kakinada and moved to Hyderabad for my first job.",
  "Today I build software for a product company and lead a small team that cares about doing things properly rather than quickly.",
  "Outside work I learn Carnatic music on the veena, cook for friends on weekends and try to read one book a month.",
  "My parents live in Guntur and I visit them every few weeks; my elder sister is a lecturer in Vijayawada.",
  "I value honesty, patience and a sense of humour, and I believe two people should keep learning from each other.",
  "I enjoy travelling to quiet places, especially hill stations and old temple towns, and I like planning trips down to the last detail.",
  "I am close to my family and hope to build a home where both families feel welcome.",
];

/** About 600 words in one paragraph-set, so it must flow onto page 2 and split at line boundaries. */
export const LONG_ABOUT: string[] = (() => {
  const paragraphs: string[] = [];
  let words = 0;
  for (let round = 0; words < 600; round++) {
    const paragraph = ABOUT_SENTENCES.slice(round % 2 === 0 ? 0 : 4).concat(ABOUT_SENTENCES.slice(0, round % 2 === 0 ? 0 : 4)).join(" ");
    paragraphs.push(paragraph);
    words += paragraph.split(/\s+/).length;
  }
  return paragraphs;
})();

/** Page 1: the fictional profile in English, laid out like a Classic Gold biodata. */
export const ENGLISH_PAGE: FixturePage = {
  lang: "en",
  language: "English",
  fontFamily: "Noto Sans",
  title: "Biodata",
  sections: [
    {
      heading: "Personal Details",
      rows: [
        ["Name", LONG_NAME],
        ["Date of Birth", "22-August-1997"],
        ["Time of Birth", "6:40 AM"],
        ["Place of Birth", "Guntur"],
        ["Birth Star", "Rohini (2nd pada)"],
        ["Raasi", "Vrishabha"],
        ["Gothram", "Kashyapa"],
        ["Height", "5' 10\" (178 cm)"],
        ["Education", "B.Tech (Electronics) – JNTU Kakinada"],
        ["Profession", "Senior Software Engineer – a product company in Hyderabad"],
        ["Annual Income", "24 LPA"],
      ],
    },
    {
      heading: "Family Details",
      rows: [
        ["Father", "Mandapati Ramakrishna, Retired Bank Manager, 90000 00001"],
        ["Mother", "Mandapati Padmavathi (Home Maker), 90000 00002"],
        ["Sister (Elder)", "Kolla Sravani (M.Sc) – Lecturer, married, Vijayawada"],
        ["Grandfather", "(Late) Mandapati Venkata Rao"],
      ],
    },
    {
      heading: "Contact Information",
      rows: [
        ["Address", LONG_ADDRESS],
        ["Phone", "+91 90000 00003"],
      ],
    },
  ],
  about: { heading: "About Me", paragraphs: LONG_ABOUT },
};

/** One page per Indian language: the same labels, with values that stress that script's shaping. */
export const SCRIPT_PAGES: FixturePage[] = [
  {
    lang: "te",
    language: "Telugu",
    fontFamily: "Noto Sans Telugu",
    title: "బయోడేటా",
    sections: [
      {
        heading: "వ్యక్తిగత వివరాలు",
        rows: [
          ["పేరు", "శ్రీ వెంకట కృష్ణమూర్తి మండపాటి"],
          ["పుట్టిన తేదీ", "౨౨-ఆగస్టు-౧౯౯౭ (22-08-1997)"],
          ["పుట్టిన ప్రదేశం", "విశాఖపట్నం"],
          ["విద్య", "బి.టెక్ (ఎలక్ట్రానిక్స్) – JNTU కాకినాడ"],
          ["ఉద్యోగం", "సాఫ్ట్‌వేర్ ఇంజనీర్, హైదరాబాద్"],
        ],
      },
      {
        heading: "కుటుంబ వివరాలు",
        rows: [
          ["తండ్రి", "శ్రీ రామకృష్ణ (విశ్రాంత బ్యాంకు మేనేజర్)"],
          ["తల్లి", "శ్రీమతి లక్ష్మి పద్మావతి, స్త్రీ శిశు సంక్షేమ శాఖ"],
          ["చిరునామా", "ఇంటి నం. 12-3/4, శ్రీనగర్ కాలనీ, గుంటూరు – 522002"],
          ["ఫోన్", "+91 90000 00003"],
        ],
      },
    ],
    about: {
      heading: "నా గురించి",
      paragraphs: ["ప్రశాంతంగా, సంతోషంగా ఉండే వ్యక్తిని. కర్ణాటక సంగీతం, క్రికెట్ అంటే ఇష్టం. కుటుంబానికి దగ్గరగా ఉంటాను; క్షమ, నిజాయితీ ముఖ్యమని నమ్ముతాను."],
    },
  },
  {
    lang: "hi",
    language: "Hindi",
    fontFamily: "Noto Sans Devanagari",
    title: "बायोडाटा",
    sections: [
      {
        heading: "व्यक्तिगत विवरण",
        rows: [
          ["नाम", "श्री कृष्ण कुमार शर्मा"],
          ["जन्म तिथि", "२२-अगस्त-१९९७ (22-08-1997)"],
          ["जन्म स्थान", "प्रयागराज"],
          ["शिक्षा", "एम.टेक (कंप्यूटर विज्ञान), IIT दिल्ली"],
          ["व्यवसाय", "द्वितीय श्रेणी अधिकारी, केंद्रीय कार्यालय"],
        ],
      },
      {
        heading: "पारिवारिक विवरण",
        rows: [
          ["पिता", "श्री रामेश्वर प्रसाद शर्मा (सेवानिवृत्त)"],
          ["माता", "श्रीमती सुनीता शर्मा (गृहिणी)"],
          ["पता", "मकान नं. 12, सैंपल नगर, लखनऊ – 226001"],
          ["फ़ोन", "+91 90000 00004"],
        ],
      },
    ],
    about: {
      heading: "मेरे बारे में",
      paragraphs: ["मैं शांत स्वभाव का हूँ और परिवार के साथ समय बिताना पसंद करता हूँ। मुझे लगता है कि ईमानदारी और धैर्य किसी भी रिश्ते की नींव हैं।"],
    },
  },
  {
    lang: "ta",
    language: "Tamil",
    fontFamily: "Noto Sans Tamil",
    title: "சுயவிவரம்",
    sections: [
      {
        heading: "தனிப்பட்ட விவரங்கள்",
        rows: [
          ["பெயர்", "ஸ்ரீ லக்ஷ்மி நாராயணன்"],
          ["பிறந்த தேதி", "22-ஆகஸ்ட்-1997"],
          ["பிறந்த இடம்", "கொடைக்கானல்"],
          ["கல்வி", "பி.இ. (மின்னணுவியல்), அண்ணா பல்கலைக்கழகம்"],
          ["தொழில்", "மென்பொருள் பொறியாளர், சென்னை"],
        ],
      },
      {
        heading: "குடும்ப விவரங்கள்",
        rows: [
          ["தந்தை", "திரு. கோபாலகிருஷ்ணன் (ஓய்வு பெற்ற ஆசிரியர்)"],
          ["தாய்", "திருமதி. கௌசல்யா (இல்லத்தரசி)"],
          ["முகவரி", "எண் 12, மாதிரி தெரு, கோயம்புத்தூர் – 641001"],
          ["தொலைபேசி", "+91 90000 00005"],
        ],
      },
    ],
    about: {
      heading: "என்னைப் பற்றி",
      paragraphs: ["அமைதியான, குடும்பத்தை நேசிக்கும் நபர். கர்நாடக இசையும் பயணமும் எனக்குப் பிடிக்கும்."],
    },
  },
  {
    lang: "kn",
    language: "Kannada",
    fontFamily: "Noto Sans Kannada",
    title: "ಬಯೋಡೇಟಾ",
    sections: [
      {
        heading: "ವೈಯಕ್ತಿಕ ವಿವರಗಳು",
        rows: [
          ["ಹೆಸರು", "ಶ್ರೀ ಕೃಷ್ಣ ಪ್ರಸಾದ್"],
          ["ಜನ್ಮ ದಿನಾಂಕ", "೨೨-ಆಗಸ್ಟ್-೧೯೯೭ (22-08-1997)"],
          ["ಜನ್ಮ ಸ್ಥಳ", "ಮೈಸೂರು, ಕರ್ನಾಟಕ"],
          ["ಶಿಕ್ಷಣ", "ಬಿ.ಇ. (ಎಲೆಕ್ಟ್ರಾನಿಕ್ಸ್), ವಿಶ್ವೇಶ್ವರಯ್ಯ ತಾಂತ್ರಿಕ ವಿಶ್ವವಿದ್ಯಾಲಯ"],
          ["ಉದ್ಯೋಗ", "ಸಾಫ್ಟ್‌ವೇರ್ ಇಂಜಿನಿಯರ್, ಬೆಂಗಳೂರು"],
        ],
      },
      {
        heading: "ಕುಟುಂಬದ ವಿವರಗಳು",
        rows: [
          ["ತಂದೆ", "ಶ್ರೀ ರಾಮಚಂದ್ರ (ನಿವೃತ್ತ ಶಿಕ್ಷಕರು)"],
          ["ತಾಯಿ", "ಶ್ರೀಮತಿ ಲಕ್ಷ್ಮೀ (ಗೃಹಿಣಿ)"],
          ["ವಿಳಾಸ", "ಮನೆ ಸಂ. 12, ಮಾದರಿ ಬಡಾವಣೆ, ಮೈಸೂರು – 570001"],
          ["ದೂರವಾಣಿ", "+91 90000 00006"],
        ],
      },
    ],
    about: {
      heading: "ನನ್ನ ಬಗ್ಗೆ",
      paragraphs: ["ಶಾಂತ ಸ್ವಭಾವದ, ಕುಟುಂಬವನ್ನು ಪ್ರೀತಿಸುವ ವ್ಯಕ್ತಿ. ಸಂಗೀತ ಮತ್ತು ಪ್ರವಾಸ ನನಗೆ ಇಷ್ಟ."],
    },
  },
  {
    lang: "ml",
    language: "Malayalam",
    fontFamily: "Noto Sans Malayalam",
    title: "ബയോഡാറ്റ",
    sections: [
      {
        heading: "വ്യക്തിഗത വിവരങ്ങൾ",
        rows: [
          ["പേര്", "ശ്രീ ലക്ഷ്മി നാരായണൻ"],
          ["ജനന തീയതി", "22-ഓഗസ്റ്റ്-1997"],
          ["ജനന സ്ഥലം", "തിരുവനന്തപുരം"],
          ["വിദ്യാഭ്യാസം", "ബി.ടെക് (ഇലക്ട്രോണിക്സ്), കേരള സർവകലാശാല"],
          ["തൊഴിൽ", "സോഫ്റ്റ്‌വെയർ എഞ്ചിനീയർ, കൊച്ചി"],
        ],
      },
      {
        heading: "കുടുംബ വിവരങ്ങൾ",
        rows: [
          ["അച്ഛൻ", "ശ്രീ രാമകൃഷ്ണൻ (വിരമിച്ച അധ്യാപകൻ)"],
          ["അമ്മ", "ശ്രീമതി പത്മാവതി (വീട്ടമ്മ)"],
          ["വിലാസം", "വീട് നം. 12, മാതൃകാ നഗർ, കൊച്ചി – 682001"],
          ["ഫോൺ", "+91 90000 00007"],
        ],
      },
    ],
    about: {
      heading: "എന്നെക്കുറിച്ച്",
      paragraphs: ["ശാന്തനും കുടുംബത്തെ സ്നേഹിക്കുന്നവനുമാണ്. സംഗീതവും യാത്രയും ഇഷ്ടമാണ്; ക്ഷമയും സത്യസന്ധതയും പ്രധാനമാണെന്ന് വിശ്വസിക്കുന്നു."],
    },
  },
  {
    lang: "mr",
    language: "Marathi",
    fontFamily: "Noto Sans Devanagari",
    title: "बायोडेटा",
    sections: [
      {
        heading: "वैयक्तिक माहिती",
        rows: [
          ["नाव", "श्री. प्रसाद श्रीकांत कुलकर्णी"],
          ["जन्मतारीख", "२२-ऑगस्ट-१९९७ (22-08-1997)"],
          ["जन्मस्थळ", "कोल्हापूर, महाराष्ट्र"],
          ["शिक्षण", "बी.ई. (इलेक्ट्रॉनिक्स), पुणे विद्यापीठ"],
          ["व्यवसाय", "सॉफ्टवेअर अभियंता, पुणे"],
        ],
      },
      {
        heading: "कौटुंबिक माहिती",
        rows: [
          ["वडील", "श्री. श्रीकांत कुलकर्णी (निवृत्त)"],
          ["आई", "सौ. सुनीता कुलकर्णी (गृहिणी)"],
          ["पत्ता", "घर क्र. 12, नमुना नगर, कोल्हापूर – 416001"],
          ["फोन", "+91 90000 00008"],
        ],
      },
    ],
    about: {
      heading: "माझ्याबद्दल",
      paragraphs: ["शांत स्वभावाचा आणि कुटुंबाला महत्त्व देणारा. सह्याद्रीच्या दर्‍याखोर्‍यांत फिरायला आवडते."],
    },
  },
  {
    lang: "gu",
    language: "Gujarati",
    fontFamily: "Noto Sans Gujarati",
    title: "બાયોડેટા",
    sections: [
      {
        heading: "વ્યક્તિગત વિગતો",
        rows: [
          ["નામ", "શ્રી ચંદ્રકાંત પટેલ"],
          ["જન્મ તારીખ", "૨૨-ઑગસ્ટ-૧૯૯૭ (22-08-1997)"],
          ["જન્મ સ્થળ", "અમદાવાદ"],
          ["શિક્ષણ", "બી.ઈ. (ઇલેક્ટ્રોનિક્સ), ગુજરાત યુનિવર્સિટી"],
          ["વ્યવસાય", "સોફ્ટવેર એન્જિનિયર, ગાંધીનગર"],
        ],
      },
      {
        heading: "કૌટુંબિક વિગતો",
        rows: [
          ["પિતા", "શ્રી રમેશચંદ્ર પટેલ (નિવૃત્ત શિક્ષક)"],
          ["માતા", "શ્રીમતી ઇન્દ્રાબેન પટેલ (ગૃહિણી)"],
          ["સરનામું", "મકાન નં. 12, નમૂના સોસાયટી, અમદાવાદ – 380001"],
          ["ફોન", "+91 90000 00009"],
        ],
      },
    ],
    about: {
      heading: "મારા વિશે",
      paragraphs: ["શાંત સ્વભાવનો અને પરિવારને મહત્વ આપનાર વ્યક્તિ. સંગીત અને પ્રવાસ ગમે છે."],
    },
  },
  {
    lang: "bn",
    language: "Bengali",
    fontFamily: "Noto Sans Bengali",
    title: "বায়োডাটা",
    sections: [
      {
        heading: "ব্যক্তিগত তথ্য",
        rows: [
          ["নাম", "শ্রী সূর্য লক্ষ্মীকান্ত মুখার্জি"],
          ["জন্ম তারিখ", "২২-আগস্ট-১৯৯৭ (22-08-1997)"],
          ["জন্মস্থান", "কলকাতা"],
          ["শিক্ষা", "বি.টেক (ইলেকট্রনিক্স), যাদবপুর বিশ্ববিদ্যালয়"],
          ["পেশা", "সফটওয়্যার ইঞ্জিনিয়ার, কার্যালয়: সল্টলেক"],
        ],
      },
      {
        heading: "পারিবারিক তথ্য",
        rows: [
          ["পিতা", "শ্রী রামকৃষ্ণ মুখার্জি (অবসরপ্রাপ্ত)"],
          ["মাতা", "শ্রীমতী কিরণ মুখার্জি (গৃহিণী)"],
          ["ঠিকানা", "বাড়ি নং 12, নমুনা পল্লী, কলকাতা – 700001"],
          ["ফোন", "+91 90000 00010"],
        ],
      },
    ],
    about: {
      heading: "আমার সম্পর্কে",
      paragraphs: ["শান্ত স্বভাবের, পরিবারকে ভালোবাসি। কি করে ভালো মানুষ হওয়া যায়, সেটাই আমার কাছে সবচেয়ে গুরুত্বপূর্ণ।"],
    },
  },
  {
    lang: "pa",
    language: "Punjabi",
    fontFamily: "Noto Sans Gurmukhi",
    title: "ਬਾਇਓਡਾਟਾ",
    sections: [
      {
        heading: "ਨਿੱਜੀ ਵੇਰਵੇ",
        rows: [
          ["ਨਾਮ", "ਸ਼੍ਰੀ ਪ੍ਰੀਤਮ ਸਿੰਘ ਗਿੱਲ"],
          ["ਜਨਮ ਮਿਤੀ", "੨੨-ਅਗਸਤ-੧੯੯੭ (22-08-1997)"],
          ["ਜਨਮ ਸਥਾਨ", "ਅੰਮ੍ਰਿਤਸਰ"],
          ["ਸਿੱਖਿਆ", "ਬੀ.ਟੈੱਕ (ਇਲੈਕਟ੍ਰਾਨਿਕਸ), ਪੰਜਾਬ ਯੂਨੀਵਰਸਿਟੀ"],
          ["ਕਿੱਤਾ", "ਸਾਫ਼ਟਵੇਅਰ ਇੰਜੀਨੀਅਰ, ਚੰਡੀਗੜ੍ਹ"],
        ],
      },
      {
        heading: "ਪਰਿਵਾਰਕ ਵੇਰਵੇ",
        rows: [
          ["ਪਿਤਾ", "ਸ. ਕਿਰਪਾਲ ਸਿੰਘ ਗਿੱਲ (ਸੇਵਾਮੁਕਤ)"],
          ["ਮਾਤਾ", "ਸ਼੍ਰੀਮਤੀ ਪ੍ਰਕਾਸ਼ ਕੌਰ (ਘਰੇਲੂ)"],
          ["ਪਤਾ", "ਮਕਾਨ ਨੰ. 12, ਨਮੂਨਾ ਨਗਰ, ਅੰਮ੍ਰਿਤਸਰ – 143001"],
          ["ਫ਼ੋਨ", "+91 90000 00011"],
        ],
      },
    ],
    about: {
      heading: "ਮੇਰੇ ਬਾਰੇ",
      paragraphs: ["ਸ਼ਾਂਤ ਸੁਭਾਅ ਦਾ ਅਤੇ ਪਰਿਵਾਰ ਨੂੰ ਪਿਆਰ ਕਰਨ ਵਾਲਾ। ਕਿਤਾਬਾਂ ਅਤੇ ਯਾਤਰਾ ਪਸੰਦ ਹੈ।"],
    },
  },
];

export const ALL_PAGES: FixturePage[] = [ENGLISH_PAGE, ...SCRIPT_PAGES];
