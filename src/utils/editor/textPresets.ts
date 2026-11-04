/** The text styles the Text tool offers (its flyout), and their preview look. */
export interface TextPreset {
  label: string;
  fontFamily: string;
  fontSize: number;
  fontWeight: number;
  fontStyle?: string;
  /** Accent tone of the card's icon badge; the CSS owns the colours. */
  tone: 'cyan' | 'gold' | 'teal' | 'green' | 'purple';
  /** Preview font stack used for the card label. */
  previewFamily: string;
  /** Tracking applied to the preview label, for presets that need it. */
  letterSpacing?: number;
  description: string;
}

export const TEXT_PRESETS: TextPreset[] = [
  {
    label: 'Display Title',
    fontFamily: 'Bebas Neue',
    fontSize: 64,
    fontWeight: 400,
    tone: 'cyan',
    previewFamily: "'Bebas Neue', sans-serif",
    description: 'Bebas Neue · 64px',
  },
  {
    label: 'Heading',
    fontFamily: 'Outfit',
    fontSize: 48,
    fontWeight: 800,
    tone: 'cyan',
    previewFamily: 'Outfit',
    description: 'Outfit · 48px',
  },
  {
    label: 'Cinematic Title',
    fontFamily: 'Playfair Display',
    fontSize: 42,
    fontWeight: 400,
    fontStyle: 'italic',
    tone: 'gold',
    previewFamily: "'Playfair Display', serif",
    description: 'Playfair Display · 42px',
  },
  {
    label: 'Subheading',
    fontFamily: 'Inter',
    fontSize: 24,
    fontWeight: 600,
    tone: 'teal',
    previewFamily: 'Inter',
    description: 'Inter · 24px',
  },
  {
    label: 'Body Text',
    fontFamily: 'Inter',
    fontSize: 16,
    fontWeight: 400,
    tone: 'green',
    previewFamily: 'Inter',
    description: 'Inter · 16px',
  },
  {
    label: 'Button Label',
    fontFamily: 'Montserrat',
    fontSize: 16,
    fontWeight: 700,
    tone: 'purple',
    previewFamily: 'Montserrat',
    letterSpacing: 0.5,
    description: 'Montserrat · 16px',
  },
];
