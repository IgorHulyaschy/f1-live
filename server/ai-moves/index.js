/**
 * FastF1 Live Timing - SignalR Negotiation
 *
 * This module handles the initial negotiation with F1's live timing servers
 * to obtain the necessary cookies and connection parameters for WebSocket.
 */

const NEGOTIATE_URL = "https://livetiming.formula1.com/signalrcore/negotiate";
const CONNECTION_URL = "wss://livetiming.formula1.com/signalrcore";

/**
 * Perform OPTIONS request to negotiate endpoint to get AWSALBCORS cookie
 * This cookie is required for authenticating WebSocket connections
 *
 * @returns {Promise<{cookie: string, negotiateResponse: object}>}
 */
async function negotiateConnection() {
  console.log("Negotiating connection with F1 live timing servers...");

  try {
    // Step 1: OPTIONS request to get AWSALBCORS cookie
    const optionsResponse = await fetch(NEGOTIATE_URL, {
      method: "OPTIONS",
      headers: {
        Accept: "*/*",
        "Accept-Language": "en-US,en;q=0.9",
        "Access-Control-Request-Method": "POST",
        "Access-Control-Request-Headers": "content-type,x-requested-with",
        Origin: "https://www.formula1.com",
        Referer: "https://www.formula1.com/",
      },
      credentials: "include",
    });

    console.log("OPTIONS response status:", optionsResponse.status);
    console.log("OPTIONS response headers:");

    // Log all headers
    for (const [key, value] of optionsResponse.headers.entries()) {
      console.log(`  ${key}: ${value}`);
    }

    // Extract AWSALBCORS cookie from Set-Cookie header
    // Note: In browsers, Set-Cookie is not accessible due to security
    // This works in Node.js with node-fetch or similar
    const setCookie = optionsResponse.headers.get("set-cookie");
    let awsalbcors = null;

    if (setCookie) {
      const match = setCookie.match(/AWSALBCORS=([^;]+)/);
      if (match) {
        awsalbcors = match[1];
        console.log("Got AWSALBCORS cookie:", awsalbcors);
      }
    }

    // Step 2: POST request to negotiate endpoint to get connection info
    const negotiateResponse = await fetch(
      NEGOTIATE_URL + "?negotiateVersion=1",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Requested-With": "XMLHttpRequest",
          Origin: "https://www.formula1.com",
          Referer: "https://www.formula1.com/",
          ...(awsalbcors && { Cookie: `AWSALBCORS=${awsalbcors}` }),
        },
        credentials: "include",
        body: JSON.stringify({}),
      }
    );

    console.log("\nNegotiate response status:", negotiateResponse.status);

    if (!negotiateResponse.ok) {
      throw new Error(
        `Negotiate failed with status ${negotiateResponse.status}`
      );
    }

    const negotiateData = await negotiateResponse.json();
    console.log("Negotiate response:", JSON.stringify(negotiateData, null, 2));

    return {
      cookie: awsalbcors,
      negotiateResponse: negotiateData,
      connectionUrl: CONNECTION_URL,
    };
  } catch (error) {
    console.error("Negotiation failed:", error.message);
    throw error;
  }
}

/**
 * Get connection parameters for SignalR WebSocket
 *
 * @returns {Promise<object>} Connection parameters including token and URL
 */
async function getConnectionParams() {
  const { cookie, negotiateResponse, connectionUrl } =
    await negotiateConnection();

  // The negotiate response contains:
  // - connectionId: unique connection identifier
  // - connectionToken: token for authentication (if available)
  // - availableTransports: supported transports (WebSockets, SSE, etc.)

  const params = {
    baseUrl: connectionUrl,
    cookie: cookie,
    connectionId: negotiateResponse.connectionId,
    connectionToken: negotiateResponse.connectionToken,
    availableTransports: negotiateResponse.availableTransports || [],
    negotiateVersion: negotiateResponse.negotiateVersion,
  };

  console.log("\nConnection parameters:");
  console.log("  Base URL:", params.baseUrl);
  console.log("  Connection ID:", params.connectionId);
  console.log(
    "  Available transports:",
    params.availableTransports.map((t) => t.transport).join(", ")
  );

  return params;
}

/**
 * Build WebSocket URL with connection parameters
 *
 * @param {object} params - Connection parameters from getConnectionParams()
 * @returns {string} Full WebSocket URL
 */
function buildWebSocketUrl(params) {
  const url = new URL(params.baseUrl);

  if (params.connectionId) {
    url.searchParams.set("id", params.connectionId);
  }

  return url.toString();
}

/**
 * Topics to subscribe to for live timing data
 */
const LIVE_TIMING_TOPICS = [
  "Heartbeat",
  "AudioStreams",
  "DriverList",
  "ExtrapolatedClock",
  "RaceControlMessages",
  "SessionInfo",
  "SessionStatus",
  "TeamRadio",
  "TimingAppData",
  "TimingStats",
  "TrackStatus",
  "WeatherData",
  "Position.z",
  "CarData.z",
  "ContentStreams",
  "SessionData",
  "TimingData",
  "TopThree",
  "RcmSeries",
  "LapCount",
];

// ============================================
// Exports
// ============================================

module.exports = {
  negotiateConnection,
  getConnectionParams,
  buildWebSocketUrl,
  NEGOTIATE_URL,
  CONNECTION_URL,
  LIVE_TIMING_TOPICS,
};
