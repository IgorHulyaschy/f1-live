import type { SessionEvent } from "../../../infra/f1-client/types/sync-events.types.js";
import { SessionType } from "../../entities/Session.js";

export function fromSessionEventType(type: SessionEvent["Name"]): SessionType {
  switch (type) {
    case "Race":
      return SessionType.RACE;
    case "Qualifying":
      return SessionType.QUALIFYING;
    case "Sprint":
      return SessionType.SPRINT;
    case "Sprint Qualifying":
      return SessionType.SPRINT_QUALIFYING;
    case "Practice":
      return SessionType.PRACTICE;
    case "Practice 2":
      return SessionType.PRACTICE_2;
    case "Practice 3":
      return SessionType.PRACTICE_3;
    default: {
      const unsupportedType: never = type;
      throw new Error(`Unknown session type: ${unsupportedType}`);
    }
  }
}
