import WebSocket from "ws";

type Topics = "TimingData" | "LapCount";

export class LiveTimingClient {
  private connection!: WebSocket;
  private cookie!: string;
  private connectionParam!: string;

  constructor(
    private readonly negotiateUrl: string,
    private readonly wsUrl: string
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
      }
    );
  }

  onMessage(callbackMap: Record<Topics, (data: string) => void>) {
    this.connection.on("message", (data) => {
      const messages = data.toString().split("\x1e").filter(Boolean);
      for (const msg of messages) {
        const parsed = JSON.parse(msg);

        for (const [key, value] of Object.entries(parsed.result)) {
          const handler = callbackMap[key as Topics];
            void handler(value);
        }
      }
    });
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
      }
    );

    if (!negotiateResponse.ok) {
      throw new Error(
        `Negotiate failed with status ${negotiateResponse.status.toString()}`
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
