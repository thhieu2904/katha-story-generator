export interface Character {
  id: number;
  name: string;
  age: number | null;
  personality_vi: string | null;
  appearance_vi: string | null;
  ref_image_urls: string[];
}
