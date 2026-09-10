import type { DetailLevel, RitualSpeed, SceneId, SpreadType } from "@/data/scenes";

export type ReadingStatus =
  | "draft"
  | "shuffling"
  | "drawing"
  | "revealed"
  | "interpreting"
  | "ready_for_followup"
  | "archived"
  | "failed";

export type DrawnCard = {
  position: string;
  positionLabel: string;
  cardId: string;
  reversed: boolean;
};

export type SpreadResult = {
  spread: SpreadType;
  cards: DrawnCard[];
};

export type Reading = {
  id: string;
  userId: string | null;
  anonymousId: string | null;
  title: string;
  question: string;
  scene: SceneId;
  spreadType: SpreadType;
  spreadResult: SpreadResult;
  status: ReadingStatus;
  detailLevel: DetailLevel;
  ritualSpeed: RitualSpeed;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
};

export type Message = {
  id: string;
  readingId: string;
  role: "user" | "assistant" | "system";
  content: string;
  createdAt: string;
};

export type PublicUser = {
  id: string;
  username: string;
  displayName: string | null;
};
