export type PaletteSourceKind = "product-media" | "curated-design";

export type PaletteAttribution = {
  name: string;
  url: string;
  license?: string;
};

export type VegaPaperPalette = {
  id: string;
  displayName: string;
  sourceKind: PaletteSourceKind;
  attribution: PaletteAttribution;
  colors: [string, string, string, string, string, string];
  selectionNotes: string;
};
