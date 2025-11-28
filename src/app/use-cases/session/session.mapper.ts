import type { SessionEvent } from "../../../infra/f1-client/types/sync-events.types.js";
import { SessionType } from "../../entities/Session.js";

export function fromSessionEventType(type: SessionEvent["Type"]): SessionType {
  switch (type) {
    case "Race":
      return SessionType.RACE;
    case "Qualifying":
      return SessionType.QUALIFYING;
    case "Sprint":
      return SessionType.SPRINT;
    case "SprintQualifying":
      return SessionType.SPRINT_QUALIFYING;
    case "Practice":
      return SessionType.PRACTICE;
    default: {
      const unsupportedType: never = type;
      throw new Error(`Unknown session type: ${unsupportedType}`);
    }
  }
}
