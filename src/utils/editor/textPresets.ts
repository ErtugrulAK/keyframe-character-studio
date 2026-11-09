/**
 * The text styles the options bar offers for a text layer (its Style list):
 * a font and a size. Picking one writes both; a layer whose font and size
 * match a style shows that style's name.
 */
export interface TextPreset {
  label: string;
  fontFamily: string;
  fontSize: number;
}

export const TEXT_PRESETS: TextPreset[] = [
  { label: 'Display Title', fontFamily: 'Bebas Neue', fontSize: 64 },
  { label: 'Heading', fontFamily: 'Outfit', fontSize: 48 },
  { label: 'Cinematic Title', fontFamily: 'Playfair Display', fontSize: 42 },
  { label: 'Subheading', fontFamily: 'Inter', fontSize: 24 },
  { label: 'Body Text', fontFamily: 'Inter', fontSize: 16 },
  { label: 'Button Label', fontFamily: 'Montserrat', fontSize: 16 },
];
