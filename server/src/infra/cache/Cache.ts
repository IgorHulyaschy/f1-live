/** In-memory state for the session currently being ingested. */
export class Cache {
	/** Empty until the first SessionInfo message arrives. */
	sessionId = '';
}
