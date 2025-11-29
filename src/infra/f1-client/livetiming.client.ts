import fs from "fs";

import WebSocket from "ws";

import type { LiveHandlerFactory } from "../../app/use-cases/live/live.handler.js";
import type { Logger } from "../logger/index.js";

import { Topic } from "./types/constants.js";
import type { CallBackMap } from "./types/sync-events.types.js";

const wsMessageDelimiter = "\x1e";

export class LiveTimingClient {
  private connection!: WebSocket;
  private cookie!: string;
  private connectionParam!: string;

  constructor(
    private readonly logger: Logger,
    private readonly negotiateUrl: string,
    private readonly wsUrl: string,
  ) {}

  async init() {
    await this.negotiateConnection();
    this.connection = new WebSocket(
      `${this.wsUrl}?id=${encodeURIComponent(this.connectionParam)}`,
      {
        headers: {
          Cookie: `AWSALBCORS=${this.cookie}`,
          Origin: "https://www.formula1.com",
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        },
      },
    );

    this.connection.on("open", () => {
      this.logger.info("Websocket connected");

      this.connection.send(
        `${JSON.stringify({
          protocol: "json",
          version: 1,
        })}${wsMessageDelimiter}`,
      );
    });

    this.connection.on("error", (error) => {
      this.logger.error(error);
    });

    this.connection.on("close", (code, reason) => {
      this.logger.info(`Websocket closed: ${code} ${reason}`);
    });
  }

  stop() {
    this.connection.close();
  }

  onMessage(callbackMap: CallBackMap, liveHandlerFactory: LiveHandlerFactory) {
    let counter = 5100;
    this.connection.on("message", (data) => {
      const messages = data.toString().split("\x1e").filter(Boolean);
      for (const msg of messages) {
        if (msg === "{}") {
          this.logger.info("Handshake completed!");
          this.subscribesToTopics();
          return;
        }

        const parsed = JSON.parse(msg);

        if (parsed.type === 6) {
          this.connection.send(
            `${JSON.stringify({ type: 6 })}${wsMessageDelimiter}`,
          );
          return;
        }

        if (parsed.type === 3 && parsed.result) {
          for (const [key, value] of Object.entries(parsed.result)) {
            this.logger.info(`[RECEIVED INFO] for ${key}`);
            if (callbackMap[key as Topic]) {
              const handler = callbackMap[key as Topic];
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              void handler(value as any);
            }

            fs.writeFileSync(
              `./sprint/live-update-${key}.json`,
              JSON.stringify(value, null, 2),
            );
          }
        }

        if (parsed.type === 1 && parsed.target === "feed") {
          this.logger.info(`[LIVE UPDATE] ${counter}`);
          // void liveUpdatesCallback(parsed.arguments);
          counter += 1;
          fs.writeFileSync(
            `./sprint/live-update-${counter}.json`,
            JSON.stringify(parsed.arguments, null, 2),
          );

          if (typeof parsed.arguments === "string") {
            return;
          }

          void liveHandlerFactory.handleLiveUpdates(parsed.arguments);
        }
      }
    });
  }

  private subscribesToTopics() {
    this.connection.send(
      JSON.stringify({
        arguments: [[Topic.SESSION_INFO, Topic.DRIVER_LIST, Topic.TIMING_DATA]],
        invocationId: "1",
        target: "Subscribe",
        type: 1,
      }) + wsMessageDelimiter,
    );
  }

  async negotiateConnection() {
    const optionsResponse = await fetch(this.negotiateUrl, {
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

    const setCookie = optionsResponse.headers.get("set-cookie");
    let awsalbcors = null;

    if (setCookie) {
      const match = /AWSALBCORS=([^;]+)/.exec(setCookie);
      if (match) {
        awsalbcors = match[1];
      }
    }

    // Step 2: POST request to negotiate endpoint to get connection info
    const negotiateResponse = await fetch(
      this.negotiateUrl + "?negotiateVersion=1",
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
      },
    );

    if (!negotiateResponse.ok) {
      throw new Error(
        `Negotiate failed with status ${negotiateResponse.status.toString()}`,
      );
    }

    const negotiateData = (await negotiateResponse.json()) as {
      connectionToken: string;
      connectionId: string;
    };

    this.cookie = awsalbcors as string;
    this.connectionParam =
      negotiateData.connectionToken || negotiateData.connectionId;
  }
}
