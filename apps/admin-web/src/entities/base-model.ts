export abstract class BaseModel {
  public readonly id: string;
  public readonly createdAt: Date;
  public readonly updatedAt: Date;

  constructor(data: { id: string; createdAt?: string | Date; updatedAt?: string | Date }) {
    this.id = data.id;
    this.createdAt = data.createdAt ? new Date(data.createdAt) : new Date();
    this.updatedAt = data.updatedAt ? new Date(data.updatedAt) : new Date();
  }

  /**
   * Chuyển đổi thực thể thành đối tượng JSON thuần túy (plain object)
   * Phù hợp để truyền dữ liệu qua Next.js Server Components hoặc lưu vào React state.
   */
  public toJSON(): Record<string, any> {
    return {
      id: this.id,
      createdAt: this.createdAt.toISOString(),
      updatedAt: this.updatedAt.toISOString(),
    };
  }
}
