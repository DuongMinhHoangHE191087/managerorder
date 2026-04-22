import { ZALO_GRAPH_API_BASE } from "../constants";
import { ZaloError } from "../errors";
import { BaseRequest } from "../request/BaseRequest";
import { FetchRequest } from "../request/FetchRequest";
import type {
  SocialFriendList,
  SocialMessageOptions,
  SocialPostFeedOptions,
  SocialProfile,
} from "../types";

export interface SocialClientConfig {
  request?: BaseRequest;
}

export class SocialClient {
  private readonly request: BaseRequest;

  constructor(
    public readonly userAccessToken: string,
    config: SocialClientConfig = {},
  ) {
    if (!userAccessToken) {
      throw new ZaloError("userAccessToken is required");
    }
    this.request = config.request ?? new FetchRequest();
  }

  async initialize(): Promise<void> {
    await this.request.initialize();
  }

  async shutdown(): Promise<void> {
    await this.request.shutdown();
  }

  private async get<T>(endpoint: string, params?: Record<string, string | number>): Promise<T> {
    const url = new URL(`${ZALO_GRAPH_API_BASE}/${endpoint}`);
    if (params) {
      for (const [key, value] of Object.entries(params)) {
        if (value !== undefined && value !== null) {
          url.searchParams.append(key, String(value));
        }
      }
    }

    const response = await this.request.getRaw(url.toString(), {
      headers: {
        access_token: this.userAccessToken,
      },
    });

    if (response.error && typeof response.error === "number" && response.error !== 0) {
      throw new ZaloError(`Social API Error ${response.error}: ${response.message ?? "Unknown error"}`);
    }

    return response as unknown as T;
  }

  private async post<T>(endpoint: string, data?: Record<string, string | number | boolean | null | undefined>): Promise<T> {
    const url = `${ZALO_GRAPH_API_BASE}/${endpoint}`;

    const response = await this.request.postRaw(url, data, {
      headers: {
        access_token: this.userAccessToken,
      },
    });

    if (response.error && typeof response.error === "number" && response.error !== 0) {
      throw new ZaloError(`Social API Error ${response.error}: ${response.message ?? "Unknown error"}`);
    }

    return response as unknown as T;
  }

  async getProfile(fields?: string[]): Promise<SocialProfile> {
    return this.get<SocialProfile>("me", fields && fields.length > 0 ? { fields: fields.join(",") } : undefined);
  }

  async getFriends(offset?: number, limit?: number, fields?: string[]): Promise<SocialFriendList> {
    const params: Record<string, string | number> = {};
    if (offset !== undefined) params.offset = offset;
    if (limit !== undefined) params.limit = limit;
    if (fields && fields.length > 0) params.fields = fields.join(",");

    return this.get<SocialFriendList>("me/friends", Object.keys(params).length > 0 ? params : undefined);
  }

  async sendMessageToFriend(toUserId: string, message: string, options?: SocialMessageOptions): Promise<void> {
    await this.post<unknown>("me/message", {
      to: toUserId,
      message,
      link: options?.link,
    });
  }

  async postFeed(message: string, options?: SocialPostFeedOptions): Promise<void> {
    await this.post<unknown>("me/feed", {
      message,
      link: options?.link,
    });
  }

  async sendAppRequest(toUserId: string, message: string): Promise<void> {
    await this.post<unknown>("me/apprequests", {
      to: toUserId,
      message,
    });
  }
}
