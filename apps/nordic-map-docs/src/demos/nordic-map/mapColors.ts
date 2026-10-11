/** The NordicMap color props the demo lets you change. The keys are the prop names. */
export type MapColors = {
  background: string;
  landFill: string;
  contextLandFill: string;
  contextBorderColor: string;
  borderColor: string;
  roadColor: string;
  pinColor: string;
  pinStrokeColor: string;
  selectedColor: string;
};

/** NordicMap's own defaults */
export const darkColors: MapColors = {
  background: "#06111f",
  landFill: "#12284a",
  contextLandFill: "#0c1c33",
  contextBorderColor: "#2a4365",
  borderColor: "#fecc02",
  roadColor: "#7fa7d9",
  pinColor: "#ffffff",
  pinStrokeColor: "#0b1f3a",
  selectedColor: "#fecc02",
};

export const lightColors: MapColors = {
  background: "#b9d7ea",
  landFill: "#fdfcf8",
  contextLandFill: "#e9e6df",
  contextBorderColor: "#b3ab9f",
  borderColor: "#1d5fa8",
  roadColor: "#c98a3a",
  pinColor: "#1b2b40",
  pinStrokeColor: "#ffffff",
  selectedColor: "#d6336c",
};

export const colorFields: { key: keyof MapColors; label: string }[] = [
  { key: "background", label: "Sea and lakes" },
  { key: "landFill", label: "Swedish land" },
  { key: "borderColor", label: "Swedish coast and border" },
  { key: "contextLandFill", label: "Neighbouring land" },
  { key: "contextBorderColor", label: "Neighbouring coasts and borders" },
  { key: "roadColor", label: "Roads" },
  { key: "pinColor", label: "Pins" },
  { key: "pinStrokeColor", label: "Pin outline" },
  { key: "selectedColor", label: "Selected pins" },
];

export function sameColors(a: MapColors, b: MapColors): boolean {
  return colorFields.every(({ key }) => {
    return a[key].toLowerCase() === b[key].toLowerCase();
  });
}
