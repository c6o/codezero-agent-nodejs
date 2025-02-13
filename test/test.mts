import { describe, it, expect, beforeAll, afterAll } from 'vitest';
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
      expect(() => new CodezeroAgent("orgId", "orgApiKey", "spaceId")).not.toThrow("Missing CZ_ORG_ID, CZ_ORG_API_KEY or CZ_SPACE_ID");
    });

    it('should throw if org id, org api key or space id are missing', () => {
      expect(() => new CodezeroAgent("1", "2")).toThrow("Missing CZ_ORG_ID, CZ_ORG_API_KEY or CZ_SPACE_ID");
    });
  });

  describe('node-fetch', () => {
    let hubServer: Server;
    let hubServerUrl: URL;

    let proxy: ProxyServer;
    let proxyUrl: URL;

    let targetServer: Server;
    let targetServerUrl: URL;

    beforeAll(async() => {
      hubServer = createServer((_req, res) => {
				res.end(JSON.stringify({host: '127.0.0.1', token: 'token', cert: readFileSync(`${__dirname}/server.crt`).toString()}));
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

    afterAll(() => {
      hubServer.close();
      proxy.close();
      targetServer.close();

      delete process.env.CZ_HUB_SERVER_BASE_URL;
    });

    it('should forward fetch requests via a proxy', async () => {
      const agent = new CodezeroAgent("orgId", "orgApiKey", "spaceId");
      const response = await fetch(targetServerUrl.href, { agent });

      expect(response.status).toBe(200);
      expect(await response.text()).toBe('Hello!');
    });
  });
});
