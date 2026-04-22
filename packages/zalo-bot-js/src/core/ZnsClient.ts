import { ZALO_BUSINESS_API_BASE } from "../constants";
import { ZaloError } from "../errors";
import { BaseRequest } from "../request/BaseRequest";
import { FetchRequest } from "../request/FetchRequest";

export interface ZnsClientConfig {
  request?: BaseRequest;
}

export interface ZnsTemplateResponse {
  error: number;
  message: string;
  data?: {
    msg_id: string;
    sent_time: string;
    quota?: {
      remain: number;
      daily_quota: number;
    }
  };
}

export class ZnsClient {
  private readonly request: BaseRequest;

  constructor(
    public readonly oaAccessToken: string,
    config: ZnsClientConfig = {},
  ) {
    if (!oaAccessToken) {
      throw new ZaloError("oaAccessToken is required");
    }
    this.request = config.request ?? new FetchRequest();
  }

  async initialize(): Promise<void> {
    await this.request.initialize();
  }

  async shutdown(): Promise<void> {
    await this.request.shutdown();
  }

  private async post(endpoint: string, data: Record<string, string | number | boolean | Record<string, string> | undefined>): Promise<ZnsTemplateResponse> {
    const url = `${ZALO_BUSINESS_API_BASE}/${endpoint}`;

    const response = await this.request.postRaw(url, data as any, {
      headers: {
        access_token: this.oaAccessToken,
      },
    });

    if (response.error !== undefined && typeof response.error === "number" && response.error !== 0) {
      throw new ZaloError(`ZNS API Error ${response.error}: ${response.message ?? "Unknown error"}`);
    }

    return response as unknown as ZnsTemplateResponse;
  }

  /**
   * Gửi tin nhắn ZNS đến một số điện thoại
   */
  async sendTemplateMessageByPhone(
    phone: string,
    templateId: string,
    templateData: Record<string, string>,
    trackingId?: string
  ): Promise<ZnsTemplateResponse> {
    const data: any = {
      phone,
      template_id: templateId,
      template_data: templateData,
    };
    if (trackingId) {
      data.tracking_id = trackingId;
    }
    return this.post("message/template", data);
  }

  /**
   * Gửi tin nhắn ZNS đến một Zalo User ID (người dùng đã theo dõi OA hoặc từng tương tác)
   */
  async sendTemplateMessageByUserId(
    userId: string,
    templateId: string,
    templateData: Record<string, string>,
    trackingId?: string
  ): Promise<ZnsTemplateResponse> {
    const data: any = {
      user_id: userId,
      template_id: templateId,
      template_data: templateData,
    };
    if (trackingId) {
      data.tracking_id = trackingId;
    }
    return this.post("message/template", data);
  }
}
