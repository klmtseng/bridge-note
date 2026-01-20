export enum FormatType {
  BULLETS = 'BULLETS',
  CLEANUP = 'CLEANUP',
  UPPERCASE = 'UPPERCASE',
  LOWERCASE = 'LOWERCASE'
}

export interface NoteState {
  content: string;
  lastUpdated: number;
}