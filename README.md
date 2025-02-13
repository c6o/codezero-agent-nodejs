# Codezero `http.Agent` implementation for NodeJS

## Example using `node-fetch`

```js
import fetch from "node-fetch";
import { CodezeroAgent } from "@c6o/codezero-agent";

const agent = new CodezeroAgent();
const response = await fetch("http://my-service.namespace/path", { agent });
```

## Example using `Axios`

```js
import axios from "axios";
import { CodezeroAgent } from '@c6o/codezero-agent';

const agent = new CodezeroAgent();
const response = axios({
    method: 'get',
    url: 'http://my-service.namespace/path',
    httpAgent: agent,
});
```

## Example using `http.request`

```js
import * as http from "http";
import { CodezeroAgent } from "@c6o/codezero-agent";

const agent = new CodezeroAgent();

http.get("http://my-service.namespace/path", { agent }, (res) => {
  console.log(res.statusCode, res.headers);
  res.pipe(process.stdout);
});
```

## API

### `new CodezeroAgent({ orgID: string, orgAPIKey: string, spaceID: string })`

Returns implementation of an `http.Agent` that connects to the Teamspace with the given `spaceID`.

You can get the `orgID` and `orgAPIKey` in the [Codezero Hub](https://hub.codezero.io/api-keys).

Alternatively to passing constructor arguments, you can set the following environment variables:

| Environment Variable | Description                           |
| -------------------- | ------------------------------------- |
| `CZ_ORG_ID`          | Codezero Organization ID              |
| `CZ_ORG_API_KEY`     | Codezero API Key of your Organization |
| `CZ_SPACE_ID`        | Codezero Space ID                     |
