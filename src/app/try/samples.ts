import type { Verdict } from "@/lib/verdict";

// Listings seen on Leboncoin, saved as their title and description so the checks keep working once they sell.
// The photo is always the official recall's, never the seller's.
export type Sample = { key: string; name: string; verdict: Verdict; recallId: string; image: string; caption: string | null; text: string };

export const SAMPLES: Sample[] = [
  {
    key: "acer",
    name: "Acer ES Series 5 electric scooter",
    verdict: "recalled",
    recallId: "rc:21110",
    image: "https://rappel.conso.gouv.fr/image/4cd2e913-64e2-4ee7-ab2e-923fa2177c8a.jpg",
    caption: null,
    text: "Trottinette électrique Acer ES Series 5 – 470W – Noir – État neuf\nJe vends ma trottinette électrique Acer ES Series 5 (470 W crête / 350 W nominal), noire, achetée neuve et très peu utilisée. Aucun choc, aucune rayure, elle est comme neuve (voir photos, elle est dans mon appartement, jamais laissée dehors).\n⚡ Caractéristiques :\n• Moteur 350 W (470 W en crête)\n• Vitesse max 25 km/h – 3 modes de conduite\n• Batterie lithium-ion, autonomie jusqu’à 45 km\n• Roues 10 pouces increvables\n• Double freinage : frein électronique avant + frein à disque arrière\n• Amortisseu…\n\nVoir plus",
  },
  {
    key: "hamax",
    name: "Hamax Buddy child bike seat",
    verdict: "check_label",
    recallId: "rc:23843",
    image: "https://rappel.conso.gouv.fr/image/1a77419b-298d-4862-bbc7-a55076f47f3a.jpg",
    caption: null,
    text: "Hamax Buddy\nJe vends ce siège enfant Hamax Buddy, un accessoire de transport sécurisé et confortable pour transporter votre enfant à vélo.\n- Type de produit : Siège enfant\n- Marque : Hamax\n- Modèle : Buddy\n- Univers : Enfant\n- Couleur : Gris et rouge\n- Accessoires inclus : Sangles de sécurité, Repose-pieds, Dossier rembourré\nTrès bon état\nSecond support vélo disponible si besoin.\nN'hésitez pas à me contacter pour plus d'informations ou de photos supplémentaires.\n\nVoir plus",
  },
  {
    key: "britax",
    name: "Britax Römer Smile III stroller",
    verdict: "check_label",
    recallId: "rc:22625",
    image: "https://rappel.conso.gouv.fr/image/eb12366e-1c37-4af5-9865-4d0a0b98d50d.jpg",
    caption: null,
    text: "Poussette Britax smile 3\nJe vends cette poussette tout-terrain de la marque Britax Römer, modèle Smile 3.\n- Type de produit : Poussette\n- Marque : Britax Römer\n- Modèle : Smile 3\n- Univers : Mobilité\n- Couleur : Vert marine - Atlantic Green\n- Fonctionnalités : Châssis pliable, Harnais de sécurité, Capote réglable et ouverture\nTrès bon état\nN'hésitez pas à me contacter pour plus d'informations ou de photos.\n\nJe vends donc\nLA NACELLE\nLE SIÈGE POUR ENFANT\nSIÈGE AUTO CLIPSABLE (gris)\nLA POUSSETTE\n\nATTENTION il vous fau…\n\nVoir plus",
  },
  {
    key: "sunlite",
    name: "Bébé Confort Sunlite stroller",
    verdict: "clear",
    recallId: "rc:22017",
    image: "https://rappel.conso.gouv.fr/image/ef3eb500-69b5-4009-a144-a44c0f9357e7.jpg",
    caption: "Shown: the recalled Sunlite car seat, a different product",
    text: "Poussette bébéconfort Sunlite\nJe vends cette poussette compacte Bébé Confort modèle Sunlite, idéale pour les déplacements urbains.\nPOUSSETTE BÉBÉ & ENFANT : transportez confortablement votre tout-petit de la naissance jusqu'à 22 kg grâce à la position allongée qui se transforme en siège confortable avec repose-pieds et au repose-jambes réglables.\nPLIAGE AUTOMATIQUE : grâce à sa conception intelligente, la poussette bébé Sunlite se plie sans effort d'une simple pression d'un bouton, ce qui permet de la ranger ou de la transpo…\n\nVoir plus",
  },
];

// Tech people buy second-hand, checked by name: the text is what someone would type, not a saved listing.
// Each line is the recall's own risk; the counterfeits are recalled as counterfeits.
export type TechSample = { key: string; name: string; verdict: Verdict; image: string | null; line: string; text: string };

export const TECH: TechSample[] = [
  {
    key: "catassu",
    name: "CATASSU LPT660 wireless headphones",
    verdict: "recalled",
    image: "https://ec.europa.eu/safety-gate-alerts/public/api/notification/image/11238269",
    line: "Chemical and environmental risk.",
    text: "Casque sans fil CATASSU LPT660",
  },
  {
    key: "webski",
    name: "Webski WB340 wireless earbuds",
    verdict: "recalled",
    image: "https://ec.europa.eu/safety-gate-alerts/public/api/notification/image/11227567",
    line: "Environmental risk.",
    text: "Écouteurs sans fil Webski WB340",
  },
  {
    key: "belkin20k",
    name: "Belkin BoostCharge 20K power bank",
    verdict: "recalled",
    image: "https://rappel.conso.gouv.fr/image/5b9335c9-aa3f-49e5-9e09-1fbe23c883bc.jpg",
    line: "Can overheat: fire risk.",
    text: "Batterie externe Belkin BoostCharge USB-C PD 20K BPB002",
  },
  {
    key: "belkinwatch",
    name: "Belkin BoostCharge Pro 10K for Apple Watch",
    verdict: "recalled",
    image: "https://rappel.conso.gouv.fr/image/db0f1978-b9ec-4391-b683-d04a9701ffb7.jpg",
    line: "Can overheat: fire risk.",
    text: "Batterie externe Belkin BoostCharge Pro 10K pour Apple Watch BPD005",
  },
  {
    key: "ikea",
    name: "IKEA Varmfront power bank",
    verdict: "recalled",
    image: "https://ec.europa.eu/safety-gate-alerts/public/api/notification/image/10933985",
    line: "Burn and fire risk.",
    text: "Batterie externe IKEA Varmfront 10400 mAh",
  },
  {
    key: "applefake",
    name: "Fake Apple 20W USB-C charger (A1696)",
    verdict: "recalled",
    image: "https://ec.europa.eu/safety-gate-alerts/public/api/notification/image/10971642",
    line: "Counterfeit. Electric shock and fire risk.",
    text: "Chargeur Apple USB-C 20W A1696",
  },
  {
    key: "samsung",
    name: "Samsung EP-TA0EWE fast charger",
    verdict: "recalled",
    image: "https://ec.europa.eu/safety-gate-alerts/public/api/notification/image/11011324",
    line: "Electric shock risk.",
    text: "Chargeur Samsung EP-TA0EWE",
  },
  {
    key: "dysonfake",
    name: "Fake Dyson hair dryer (HD08)",
    verdict: "recalled",
    image: "https://ec.europa.eu/safety-gate-alerts/public/api/notification/image/10999955",
    line: "Counterfeit. Fire risk.",
    text: "Sèche-cheveux Dyson HD08",
  },
  {
    key: "tilgreen",
    name: "Tilgreen hoverboard",
    verdict: "check_label",
    image: "/home/tilgreen.jpg",
    line: "Only the Tilboard model is recalled: electric shock and fire risk.",
    text: "Hoverboard Tilgreen",
  },
  {
    key: "airpods",
    name: "Apple AirPods Pro 2",
    verdict: "clear",
    image: null,
    line: "No recall matches. Vetted shows what it searched.",
    text: "Apple AirPods Pro 2 boîtier MagSafe",
  },
];
