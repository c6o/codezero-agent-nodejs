import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Server, createServer } from 'http';
import { createServer as createSSLServer } from 'https';
import { readFileSync } from 'fs';
import { listen } from 'async-listen';
import fetch from 'node-fetch';
import { ProxyServer, createProxy } from 'proxy'
import { CodezeroAgent } from '../src/index.mts';

describe('CodezeroAgent', () => {
  describe ('constructor', () => {
    it('should not throw given org id, org api key and space id', () => {
      expect(() => new CodezeroAgent({orgID: "orgId", orgApiKey: "orgApiKey", spaceID: "spaceId"})).not.toThrow("Missing CZ_ORG_ID, CZ_ORG_API_KEY or CZ_SPACE_ID");
    });

    it('should throw if org id, org api key or space id are missing', () => {
      expect(() => new CodezeroAgent({orgID: "orgId", orgApiKey: "orgApiKey"})).toThrow("Missing CZ_ORG_ID, CZ_ORG_API_KEY or CZ_SPACE_ID");
    });
  });

  describe('node-fetch', () => {
    let hubServer: Server;
    let hubServerUrl: URL;
    let receivedAuth: string;
    let hubRequestCount = 0;

    let proxy: ProxyServer;
    let proxyUrl: URL;

    let targetServer: Server;
    let targetServerUrl: URL;
    let spaceCreds: any
    
    const createToken = (offsetSeconds: number) => {
      const time = Date.now() / 1000 + offsetSeconds;
      const payload = Buffer.from(JSON.stringify({ exp: time })).toString('base64');
      return `header.${payload}`;
    }

    beforeEach(async() => {
      spaceCreds = {host: '127.0.0.1', token: createToken(3*60), cert: readFileSync(`${__dirname}/server.crt`).toString()};

      hubRequestCount = 0;
      hubServer = createServer((req, res) => {
        hubRequestCount++;
        receivedAuth = req.headers.authorization!;
				res.end(JSON.stringify(spaceCreds));
			});
      hubServerUrl = await listen(hubServer);
      process.env.CZ_HUB_SERVER_BASE_URL = hubServerUrl.href;


      proxy = createProxy(createSSLServer(
        {
          key: readFileSync(`${__dirname}/server.key`),
          cert: readFileSync(`${__dirname}/server.crt`),
        }
      ));
      proxyUrl = await listen(proxy, { port: 8800 });

      targetServer = createServer((req, res) => {
        res.end('Hello!');
      });
      targetServerUrl = await listen(targetServer);
    })

    afterEach(() => {
      hubServer.close();
      proxy.close();
      targetServer.close();

      delete process.env.CZ_HUB_SERVER_BASE_URL;
    });

    it('should forward fetch requests via a proxy', async () => {
      const agent = new CodezeroAgent({orgID: "orgId", orgApiKey: "orgApiKey", spaceID: "spaceId"});
      const response = await fetch(targetServerUrl.href, { agent });

      expect(response.status).toBe(200);
      expect(await response.text()).toBe('Hello!');

      expect(receivedAuth).toBe('orgId:orgApiKey');
    });

    it('should cache credentials in the agent instance', async () => {
      const agent = new CodezeroAgent({orgID: "orgId", orgApiKey: "orgApiKey", spaceID: "spaceId"});
      await fetch(targetServerUrl.href, { agent });
      await fetch(targetServerUrl.href, { agent });

      expect(hubRequestCount).toBe(1);
    });

    it('should refetch credentials if token is expired', async () => {
      const agent = new CodezeroAgent({orgID: "orgId", orgApiKey: "orgApiKey", spaceID: "spaceId"});

      await fetch(targetServerUrl.href, { agent });
      expect(hubRequestCount).toBe(1);

      agent['_credentials']!['token'] = createToken(-3*60);
      await fetch(targetServerUrl.href, { agent });

      expect(hubRequestCount).toBe(2);
    });
  });
});
