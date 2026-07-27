export interface UpdateGameApplicationInput {
  id: string;
  name?: string;
  exactMultiplier?: number | null;
  easyMultiplier?: number | null;
  pairEasyMultiplier?: number | null;
  imagePath?: string | null;
  orderIndex?: number;
}
