export type AgeRange = '0-2' | '3-5' | '6-8' | '9-12';

export type CharacterRole = 'protagonist' | 'antagonist' | 'supporting';

export interface Character {
  id: string;
  name: string;
  description: string;
  role: CharacterRole;
  visualDescription: string;
}

export interface StoryPlan {
  title: string;
  targetAgeRange: AgeRange;
  themes: string[];
  characters: Character[];
  synopsis: string;
  moral: string;
}

export interface BookPage {
  id: string;
  pageNumber: number;
  text: string;
  imagePrompt: string;
  imageBase64: string | null;
  hasImage: boolean;
}

export type StylePreset =
  | 'watercolor'
  | 'cartoon'
  | 'flat-illustration'
  | 'pencil-sketch'
  | 'pixel-art'
  | 'collage'
  | 'storybook-classic'
  | 'anime';

export interface ArtStyle {
  presetStyle: StylePreset | null;
  customStyleDescription: string;
  colorPalette: string[];
  characterVisuals: Record<string, string>;
  compositePrompt: string;
}

export interface Project {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  storyPlan: StoryPlan;
  pages: BookPage[];
  artStyle: ArtStyle;
  hasCoverImage: boolean;
}

export interface AppSettings {
  textModel: string;
  imageModel: string;
  imageSize: '1024x1024' | '1024x1536' | '1536x1024';
  imageQuality: 'low' | 'medium' | 'high';
}

export interface PDFExportOptions {
  pageSize: 'letter' | 'a4' | 'square';
  orientation: 'landscape' | 'portrait';
  fontSize: number;
  margins: number;
  includeTitle: boolean;
}
