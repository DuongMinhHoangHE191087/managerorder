import { SocialClient } from "../src/core/SocialClient";
import type { JsonObject, RequestOptions } from "../src/types";
import { BaseRequest, type RequestPayload } from "../src/request/BaseRequest";

class MockGraphRequest extends BaseRequest {
  readonly readTimeout = 0;

  constructor(private readonly responses: Record<string, JsonObject>) {
    super();
  }

  readonly callCount: Record<string, number> = {};

  async initialize(): Promise<void> {}
  async shutdown(): Promise<void> {}

  async getRaw(
    url: string,
    _options?: RequestOptions,
  ): Promise<JsonObject> {
    const endpoint = url.split("v2.0/").pop() ?? "";
    const baseEndpoint = endpoint.split("?")[0] ?? endpoint;
    this.callCount[baseEndpoint] = (this.callCount[baseEndpoint] ?? 0) + 1;
    return this.responses[baseEndpoint] ?? { error: 0, message: "Success" };
  }

  async postRaw(
    url: string,
    _data?: RequestPayload,
    _options?: RequestOptions,
  ): Promise<JsonObject> {
    const endpoint = url.split("v2.0/").pop() ?? "";
    this.callCount[endpoint] = (this.callCount[endpoint] ?? 0) + 1;
    return this.responses[endpoint] ?? { error: 0, message: "Success" };
  }

  protected async doRequest(): Promise<never> {
    throw new Error("MockGraphRequest.doRequest should not be called");
  }
}

async function main() {
  const profileResult = {
    id: "user-123",
    name: "John Doe",
    picture: {
      data: {
        url: "https://example.com/pic.jpg",
      },
    },
    error: 0,
    message: "Success",
  } satisfies JsonObject;

  const friendsResult = {
    data: [
      { id: "friend-1", name: "Jane" },
      { id: "friend-2", name: "Doe" },
    ],
    error: 0,
    message: "Success",
  } satisfies JsonObject;

  const request = new MockGraphRequest({
    "me": profileResult,
    "me/friends": friendsResult,
    "me/message": { error: 0, message: "Success" },
    "me/feed": { error: 0, message: "Success" },
    "me/apprequests": { error: 0, message: "Success" },
  });

  const client = new SocialClient("dummy-token", { request });

  // Test getProfile
  const profile = await client.getProfile(["id", "name", "picture"]);
  if (profile.id !== "user-123" || profile.name !== "John Doe") {
    throw new Error("getProfile failed");
  }

  // Test getFriends
  const friends = await client.getFriends(0, 10, ["id", "name"]);
  if (!friends.data || friends.data.length !== 2) {
    throw new Error("getFriends failed");
  }

  // Test sendMessageToFriend
  await client.sendMessageToFriend("friend-1", "hello graph");
  if (request.callCount["me/message"] !== 1) {
    throw new Error("sendMessageToFriend failed");
  }

  // Test postFeed
  await client.postFeed("hello world");
  if (request.callCount["me/feed"] !== 1) {
    throw new Error("postFeed failed");
  }

  // Test sendAppRequest
  await client.sendAppRequest("friend-1", "install this app");
  if (request.callCount["me/apprequests"] !== 1) {
    throw new Error("sendAppRequest failed");
  }

  console.log("social api ok");
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
