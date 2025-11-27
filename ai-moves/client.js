/**
 * FastF1 Live Timing - SignalR Client (JavaScript Port)
 *
 * This module connects to F1's live timing servers via SignalR/WebSocket
 * and receives real-time timing data during live sessions.
 *
 * Based on: fastf1/livetiming/client.py
 */

const WebSocket = require("ws");
const fs = require("fs");
const {
  negotiateConnection,
  buildWebSocketUrl,
  LIVE_TIMING_TOPICS,
  CONNECTION_URL,
} = require("./index");

// ============================================
// Quick test without saving to file
// ============================================

async function quickTest() {
  console.log("=".repeat(60));
  console.log("F1 Live Timing - Quick Connection Test");
  console.log("=".repeat(60));
  console.log();

  try {
    // Negotiate
    console.log("Step 1: Negotiating...");
    const { cookie, negotiateResponse } = await negotiateConnection();

    // Log full response to debug
    console.log(
      "  Full negotiate response:",
      JSON.stringify(negotiateResponse, null, 2)
    );

    console.log(`  Connection ID: ${negotiateResponse.connectionId}`);
    console.log(`  Connection Token: ${negotiateResponse.connectionToken}`);
    console.log(
      `  Available transports: ${negotiateResponse.availableTransports
        ?.map((t) => t.transport)
        .join(", ")}`
    );

    console.log("\nStep 2: Connecting WebSocket...");

    // Build WebSocket URL - use connectionToken if available, otherwise connectionId
    const connParam =
      negotiateResponse.connectionToken || negotiateResponse.connectionId;
    const wsUrl = `${CONNECTION_URL}?id=${encodeURIComponent(connParam)}`;
    console.log(`  WebSocket URL: ${wsUrl}`);

    const ws = new WebSocket(wsUrl, {
      headers: {
        Cookie: cookie ? `AWSALBCORS=${cookie}` : undefined,
        Origin: "https://www.formula1.com",
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      },
    });

    let messageCount = 0;

    ws.on("open", () => {
      console.log("  WebSocket connected!");

      // Send handshake
      ws.send(JSON.stringify({ protocol: "json", version: 1 }) + "\x1e");
    });

    ws.on("message", (data) => {
      const messages = data.toString().split("\x1e").filter(Boolean);

      for (const msg of messages) {
        if (msg === "{}") {
          console.log("  Handshake complete!");

          // Subscribe to topics including lap data
          const subscribe = {
            arguments: [
              [
                "Heartbeat",
                "SessionInfo",
                "SessionStatus",
                "DriverList",
                "WeatherData",
                "TimingData", // Lap times, sector times, gaps
                "TimingAppData", // Stint info, tire compounds
                "TimingStats", // Best times, speeds
                "LapCount", // Current lap number
                "RaceControlMessages",
              ],
            ],
            invocationId: "1",
            target: "Subscribe",
            type: 1,
          };
          ws.send(JSON.stringify(subscribe) + "\x1e");
          console.log("  Subscribed to topics");
          continue;
        }

        messageCount++;
        try {
          const parsed = JSON.parse(msg);

          if (parsed.type === 6) {
            // Ping
            ws.send(JSON.stringify({ type: 6 }) + "\x1e");
            return;
          }

          if (parsed.type === 3 && parsed.result) {
            // Initial data
            console.log("\n" + "=".repeat(60));
            console.log("RECEIVED INITIAL DATA:");
            console.log("=".repeat(60));

            for (const [key, value] of Object.entries(parsed.result)) {
              const preview =
                typeof value === "object"
                  ? JSON.stringify(value).substring(0, 200)
                  : String(value).substring(0, 200);
              console.log(`\n[${key}]:`);
              console.log(`  ${preview}${preview.length >= 200 ? "..." : ""}`);

              // Save to file
              const filename = `result${key.replace(/\./g, "_")}.json`;
              const content =
                typeof value === "object"
                  ? JSON.stringify(value, null, 2)
                  : JSON.stringify(value);
              fs.writeFileSync(filename, content);
              console.log(`  Saved to: ${filename}`);
            }
          }

          if (parsed.type === 1 && parsed.target === "feed") {
            console.log(`\n[LIVE UPDATE] ${JSON.stringify(parsed.arguments)}`);
          }
        } catch (e) {
          // Skip parse errors
        }
      }
    });

    ws.on("error", (error) => {
      console.error("  WebSocket error:", error);
    });

    ws.on("close", (code, reason) => {
      console.log(`\n  Connection closed: ${code}`, reason);
      console.log(`  Total messages: ${messageCount}`);
    });

    // Auto-close after 30 seconds
    setTimeout(() => {
      console.log("\n  Closing after 30 seconds...");
      ws.close();
    }, 30000);
  } catch (error) {
    console.error("Error:", error.message);
  }
}

// ============================================
// Main
// ============================================

async function main() {
  const args = process.argv.slice(2);

  if (args[0] === "save" && args[1]) {
    // Save mode: save to file
    const client = new SignalRClient(args[1], {
      timeout: parseInt(args[2]) || 60,
    });
    await client.start();
  } else if (args[0] === "test") {
    // Quick test mode
    await quickTest();
    const timingData = require("./resultTimingData.json");
    const driverList = require("./resultDriverList.json");

    console.log("\n=== Driver Lap Times ===\n");

    for (const [driverNum, data] of Object.entries(timingData.Lines)) {
      const driver = driverList[driverNum];
      const name = driver
        ? `${driver.FirstName} ${driver.LastName}`
        : `Driver #${driverNum}`;
      const bestLap = data.BestLapTime?.Value || "N/A";
      const bestLapNum = data.BestLapTime?.Lap
        ? ` (Lap ${data.BestLapTime.Lap})`
        : "";
      const lastLap = data.LastLapTime?.Value || "N/A";
      const lastLapNum = data.NumberOfLaps ? ` (Lap ${data.NumberOfLaps})` : "";

      console.log(
        `${name.padEnd(22)} | Best: ${bestLap.padEnd(10)}${bestLapNum.padEnd(
          12
        )} | Last: ${lastLap.padEnd(10)}${lastLapNum}`
      );
    }
  } else {
    console.log(`
F1 Live Timing Client (JavaScript)

Usage:
  node client.js test              - Quick connection test (30 sec)
  node client.js save <file.txt>   - Save live data to file
  node client.js save <file.txt> <timeout>

Examples:
  node client.js test
  node client.js save race_data.txt
  node client.js save race_data.txt 120

Note: This only works during a LIVE F1 session!
    `);
  }
}

// Export for use as module
module.exports = { SignalRClient, quickTest };

// Run if executed directly
if (require.main === module) {
  main().catch(console.error);
}
