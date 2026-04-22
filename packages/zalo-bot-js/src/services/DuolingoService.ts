/**
 * DuolingoService - Fetch full profile information from Duolingo API
 *
 * Hỗ trợ định dạng input:
 *   - "username"                         → tra trực tiếp
 *   - "@username"                        → tự bỏ @
 *   - "duolingo.com/profile/xxx"         → extract từ URL
 *   - "https://www.duolingo.com/profile/xxx" → extract từ URL đầy đủ
 */

export interface DuolingoLanguage {
  language: string;
  languageName: string;
  isCurrentLearning: boolean;
  level?: number;
  xp: number;
}

export interface DuolingoProfile {
  id: number;
  name: string;
  username: string;
  streak: number;
  totalXp: number;
  lingots: number;
  gems: number;
  profileUrl: string;
  avatarUrl: string;
  createdAt?: string;
  hasPlus: boolean; // Đơn giản: true nếu có subscription bất kỳ
  courses: DuolingoLanguage[];
  currentCourse?: DuolingoLanguage;
}

/**
 * Kết quả parse input: trả về username đã normalize hoặc null nếu không hợp lệ
 */
export interface ParsedInput {
  username: string;
  originalInput: string;
  inputType: "username" | "at_username" | "profile_url";
}

export class DuolingoService {
  private readonly apiBase = "https://www.duolingo.com/2017-06-30";
  private readonly profileBase = "https://www.duolingo.com/profile";

  // ──────────────────────────────────────────────────────
  // INPUT NORMALIZATION
  // ──────────────────────────────────────────────────────

  /**
   * Parse và normalize toàn bộ các định dạng input
   * Trả về ParsedInput hoặc null nếu chuỗi rỗng / không hợp lệ
   */
  parseInput(raw: string): ParsedInput | null {
    const trimmed = raw.trim();
    if (!trimmed) return null;

    // Định dạng URL: duolingo.com/profile/xxx hoặc https://...
    const urlMatch = trimmed.match(
      /(?:https?:\/\/)?(?:www\.)?duolingo\.com\/profile\/([A-Za-z0-9_.-]+)/i,
    );
    if (urlMatch?.[1]) {
      return {
        username: urlMatch[1],
        originalInput: trimmed,
        inputType: "profile_url",
      };
    }

    // Định dạng @username
    if (trimmed.startsWith("@")) {
      const username = trimmed.slice(1).trim();
      if (!username) return null;
      return { username, originalInput: trimmed, inputType: "at_username" };
    }

    // Định dạng username thuần
    return { username: trimmed, originalInput: trimmed, inputType: "username" };
  }

  /**
   * Convenience: chỉ lấy username string, bỏ qua metadata
   */
  normalizeUsername(raw: string): string {
    return this.parseInput(raw)?.username ?? "";
  }

  // ──────────────────────────────────────────────────────
  // API FETCH
  // ──────────────────────────────────────────────────────

  /**
   * Lấy toàn bộ thông tin của 1 user Duolingo theo bất kỳ định dạng input
   */
  async getUserProfile(rawInput: string): Promise<DuolingoProfile | null> {
    const parsed = this.parseInput(rawInput);
    if (!parsed) return null;

    const { username } = parsed;

    try {
      // Lấy đầy đủ fields: không giới hạn fields để có hasPlus
      const url = `${this.apiBase}/users?fields=users&username=${encodeURIComponent(username)}`;

      const response = await fetch(url, {
        headers: {
          Accept: "application/json",
          "User-Agent": "Mozilla/5.0 (compatible; ZaloBot/1.0)",
        },
        signal: AbortSignal.timeout(8000),
      });

      if (!response.ok) {
        console.warn(`[Duolingo] HTTP ${response.status} for username: ${username}`);
        return null;
      }

      const data = (await response.json()) as { users?: unknown[] };

      if (!data?.users?.length) {
        console.warn(`[Duolingo] No users found for: ${username}`);
        return null;
      }

      const raw = data.users[0] as Record<string, unknown>;
      return this.parseProfile(raw);
    } catch (error) {
      console.error("[Duolingo] Fetch error:", error);
      return null;
    }
  }

  // ──────────────────────────────────────────────────────
  // PRIVATE: PARSE
  // ──────────────────────────────────────────────────────

  private parseProfile(raw: Record<string, unknown>): DuolingoProfile {
    const courses = this.parseCourses(raw.courses as unknown[] | undefined);

    // hasPlus: chỉ dùng trường hasPlus từ API (true/false đơn giản)
    const hasPlus = raw.hasPlus === true;

    const username = (raw.username as string) ?? "";

    return {
      id: (raw.id as number) ?? 0,
      name: (raw.name as string) ?? username ?? "Unknown",
      username,
      streak: (raw.streak as number) ?? 0,
      totalXp: (raw.totalXp as number) ?? 0,
      lingots: (raw.lingots as number) ?? 0,
      gems: (raw.gems as number) ?? 0,
      profileUrl: username ? `${this.profileBase}/${username}` : "",
      avatarUrl: (raw.picture as string) ?? "",
      createdAt: raw.creationDate
        ? new Date((raw.creationDate as number) * 1000).toISOString().split("T")[0]
        : undefined,
      hasPlus,
      courses,
      currentCourse: courses.find((c) => c.isCurrentLearning),
    };
  }

  private parseCourses(raw?: unknown[]): DuolingoLanguage[] {
    if (!Array.isArray(raw)) return [];

    return raw.map((c) => {
      const course = c as Record<string, unknown>;
      return {
        language: (course.learningLanguage as string) ?? (course.id as string) ?? "",
        languageName:
          (course.title as string) ?? (course.learningLanguage as string) ?? "",
        isCurrentLearning: course.current_learning === true,
        level: typeof course.level === "number" ? course.level : undefined,
        xp: (course.xp as number) ?? (course.points as number) ?? 0,
      };
    });
  }

  // ──────────────────────────────────────────────────────
  // FORMAT OUTPUT
  // ──────────────────────────────────────────────────────

  /**
   * Format đẹp kết quả trả về cho người dùng Zalo — đầy đủ mọi trường
   */
  formatProfileMessage(profile: DuolingoProfile): string {
    const plusLabel = profile.hasPlus
      ? "✅ Super Plus (Đã kích hoạt)"
      : "❌ Chưa có gói Plus";

    const currentCourseStr = profile.currentCourse
      ? `${profile.currentCourse.languageName || profile.currentCourse.language} — ${profile.currentCourse.xp.toLocaleString("vi-VN")} XP`
      : "Chưa chọn khóa học";

    const topCourses = profile.courses
      .slice()
      .sort((a, b) => b.xp - a.xp)
      .slice(0, 5)
      .map((c, i) => {
        const levelStr = c.level != null ? ` (Lv.${c.level})` : "";
        const currentMark = c.isCurrentLearning ? " ◀ đang học" : "";
        return `  ${i + 1}. ${c.languageName || c.language}${levelStr}: ${c.xp.toLocaleString("vi-VN")} XP${currentMark}`;
      })
      .join("\n");

    const lines: string[] = [
      `🦉 ━━━━━━ DUOLINGO INFO ━━━━━━`,
      ``,
      `👤 Tên hiển thị : ${profile.name}`,
      `🔑 Username     : ${profile.username}`,
      `🆔 User ID      : ${profile.id}`,
      `🔗 Profile URL  : ${profile.profileUrl}`,
      ``,
      `━━━ TRẠNG THÁI ━━━`,
      `💎 Gói Plus     : ${plusLabel}`,
      `🔥 Streak       : ${profile.streak} ngày liên tiếp`,
      `⚡ Tổng XP      : ${profile.totalXp.toLocaleString("vi-VN")}`,
      `💰 Lingots      : ${profile.lingots.toLocaleString("vi-VN")}`,
      `💎 Gems         : ${profile.gems.toLocaleString("vi-VN")}`,
    ];

    if (profile.createdAt) {
      lines.push(`📅 Ngày tạo     : ${profile.createdAt}`);
    }

    lines.push(``);
    lines.push(`━━━ KHÓA HỌC ━━━`);
    lines.push(`📚 Đang học     : ${currentCourseStr}`);

    if (topCourses) {
      lines.push(`📊 Top 5 khóa học:`);
      lines.push(topCourses);
    } else {
      lines.push(`📊 Chưa tham gia khóa học nào.`);
    }

    lines.push(``);
    lines.push(`🦉 ━━━━━━━━━━━━━━━━━━━━━━━━━`);

    return lines.join("\n");
  }

  /**
   * Format câu hỏi cho user khi không có username (interactive mode)
   */
  formatAskUsernameMessage(): string {
    return [
      `🦉 Tra cứu Duolingo`,
      ``,
      `Vui lòng nhập username Duolingo bạn muốn tra cứu.`,
      ``,
      `💡 Hỗ trợ định dạng:`,
      `  • username          — tra trực tiếp`,
      `  • @username         — tự bỏ @`,
      `  • duolingo.com/profile/xxx — extract từ URL`,
      ``,
      `Gõ "huỷ" hoặc "cancel" để hủy bỏ.`,
    ].join("\n");
  }
}
