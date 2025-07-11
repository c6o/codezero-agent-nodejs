import type { AgentConnectOpts } from "agent-base";
import type { ClientRequest } from "http";
import { HttpsProxyAgent } from "https-proxy-agent";
import type { Socket } from "net";
import fetch from "node-fetch";

interface SpaceCredentials {
  host: string;
  token: string;
  cert: string;
}

type CodezeroParams = {
  orgID?: string;
  orgApiKey?: string;
  spaceID?: string;
};

export class CodezeroAgent extends HttpsProxyAgent<string> {
  private _credentials: SpaceCredentials | null = null;
  private _hubServerBaseUrl: string = "https://hub.codezero.io";
  private orgID: string;
  private orgApiKey: string;
  private spaceID: string;

  constructor(params: CodezeroParams = {}) {
    const orgID = params.orgID || process.env.CZ_ORG_ID;
    const orgApiKey = params.orgApiKey || process.env.CZ_ORG_API_KEY;
    const spaceID = params.spaceID || process.env.CZ_SPACE_ID;

    if (!orgID || !orgApiKey || !spaceID) {
      throw new Error("Missing CZ_ORG_ID, CZ_ORG_API_KEY or CZ_SPACE_ID");
    }

    super("https://127.0.0.1");

    this.orgID = orgID;
    this.orgApiKey = orgApiKey;
    this.spaceID = spaceID;
    this.keepAlive = true;

    if (process.env.CZ_HUB_SERVER_BASE_URL) {
      this._hubServerBaseUrl = process.env.CZ_HUB_SERVER_BASE_URL!;
    }
  }

  override async connect(
    req: ClientRequest,
    opts: AgentConnectOpts
  ): Promise<Socket> {
    const credentials = await this.getSpaceCredentials();
    this.connectOpts.servername = this.spaceID + ".spaces.codezero.io";
    this.connectOpts.ca = credentials.cert;
    this.connectOpts.host = credentials.host;
    this.connectOpts.port = 8800;
    this.proxyHeaders = { "Proxy-Authorization": credentials.token };

    return super.connect(req, opts);
  }
  private async getSpaceCredentials(): Promise<SpaceCredentials> {
    if (this._credentials && !this.tokenExpired(this._credentials.token)) {
      return this._credentials;
    }

    const spaceResponse = await fetch(
      `${this._hubServerBaseUrl}/api/c6o/connect/c6oapi.v1.C6OService/GetSpaceConnection`,
      {
        method: "POST",
        headers: {
          Authorization: `${this.orgID}:${this.orgApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          spaceId: this.spaceID,
        }),
      }
    );
    const response = (await spaceResponse.json()) as any;

    if (!spaceResponse.ok) {
      throw new Error(response.message);
    }
    this._credentials = response as SpaceCredentials;

    return this._credentials;
  }

  private tokenExpired(token: string): boolean {
    const [, payload] = token.split(".");
    if (!payload) return true;

    const decoded = JSON.parse(Buffer.from(payload, "base64").toString());
    return decoded.exp - 2 * 60 < Date.now() / 1000;
  }
}
