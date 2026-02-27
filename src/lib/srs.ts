export type Grade = "know" | "vague" | "forgot";

const STAGE_DELAYS_MINUTES = [5, 30, 12 * 60, 24 * 60, 2 * 24 * 60, 4 * 24 * 60, 7 * 24 * 60, 15 * 24 * 60, 30 * 24 * 60] as const;
const MAX_STAGE = STAGE_DELAYS_MINUTES.length - 1;

export function clampStage(stage: number): number {
  if (stage < 0) return 0;
  if (stage > MAX_STAGE) return MAX_STAGE;
  return stage;
}

export function getDelayMinutesForStage(stage: number): number {
  return STAGE_DELAYS_MINUTES[clampStage(stage)];
}

export function addMinutes(base: Date, minutes: number): Date {
  return new Date(base.getTime() + minutes * 60 * 1000);
}

export function scheduleByStage(stage: number, now: Date): Date {
  return addMinutes(now, getDelayMinutesForStage(stage));
}

export function applyGrade(stage: number, grade: Grade, now: Date): { stage: number; nextReviewAt: Date } {
  const currentStage = clampStage(stage);

  if (grade === "know") {
    const nextStage = clampStage(currentStage + 1);
    return { stage: nextStage, nextReviewAt: scheduleByStage(nextStage, now) };
  }

  if (grade === "vague") {
    const nextStage = currentStage;
    return { stage: nextStage, nextReviewAt: scheduleByStage(Math.max(nextStage - 1, 0), now) };
  }

  return { stage: 0, nextReviewAt: scheduleByStage(0, now) };
}
