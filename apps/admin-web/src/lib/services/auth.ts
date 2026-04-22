import { supabaseAdmin } from '@/lib/supabase/admin';
import { hashPassword, verifyPassword } from "@/lib/utils/crypto";
import type { ChangePasswordInput } from "@/lib/types/validation";
import { AuthenticationError, ConflictError } from "@/lib/utils/errors";
import { generateAccessToken, generateRefreshToken, verifyToken } from "@/lib/utils/jwt";
import type { AuthResponse, TokenPair, UserProfile } from "@/lib/types/auth";

// ─── Internal User Type ──────────────────────────────────────────────────────

interface InternalUser {
  id: string;
  email: string;
  passwordHash: string;
  firstName: string;
  lastName: string;
  accountId: string;
  role: string;
  status: string;
  createdAt: Date;
}

// ─── Repository ──────────────────────────────────────────────────────────────

/**
 * AuthRepository adapts to both old and new admin_users schemas:
 * 
 * Old schema: id, email, role, display_name, created_at, account_id
 * New schema: + password_hash, first_name, last_name, status
 * 
 * When new columns don't exist yet, we:
 * - Use display_name as firstName fallback
 * - Use empty string for lastName
 * - Use 'active' as default status
 * - Use empty string for passwordHash (login will fail gracefully)
 */
export class AuthRepository {
  /**
   * Map raw DB row to InternalUser, supporting both old and new schemas.
   */
  private mapRow(data: Record<string, unknown>): InternalUser {
    // Support both old schema (display_name) and new schema (first_name/last_name)
    const displayName = (data.display_name as string) ?? '';
    const firstName = (data.first_name as string) ?? displayName.split(' ')[0] ?? '';
    const lastName = (data.last_name as string) ?? 
      (displayName.includes(' ') ? displayName.substring(displayName.indexOf(' ') + 1) : '');

    return {
      id: data.id as string,
      email: data.email as string,
      passwordHash: (data.password_hash as string) ?? '',
      firstName,
      lastName,
      accountId: data.account_id as string,
      role: (data.role as string) ?? 'admin',
      status: (data.status as string) ?? 'active',
      createdAt: new Date(data.created_at as string),
    };
  }

  async findUserByEmail(email: string): Promise<InternalUser | null> {
    // First try new schema (with status filter)
    const { data, error } = await supabaseAdmin
      .from('admin_users')
      .select('*')
      .eq('email', email)
      .single();
    
    if (error || !data) {
      // Log for debugging (only in non-production for security)
      if (error && !error.message.includes('0 rows')) {
        console.error('[Auth] findUserByEmail error:', error.message);
      }
      return null;
    }

    const user = this.mapRow(data);
    
    // Check status (default 'active' if column doesn't exist)
    if (user.status !== 'active') {
      return null;
    }

    return user;
  }

  async findUserById(id: string): Promise<InternalUser | null> {
    const { data, error } = await supabaseAdmin
      .from('admin_users')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !data) return null;
    return this.mapRow(data);
  }

  async findAccountByEmail(email: string) {
    const { data } = await supabaseAdmin
      .from('admin_users')
      .select('account_id, email')
      .eq('email', email)
      .single();
    return data ?? null;
  }

  async createAccount(email: string, name: string) {
    const { data, error } = await supabaseAdmin
      .from('accounts')
      .insert({
        name,
        owner_email: email,
        status: 'active',
      })
      .select()
      .single();
    
    if (error) {
      throw new Error(`[Auth] Failed to create account: ${error.message}`);
    }

    return { id: data.id, name: data.name, email, status: data.status ?? 'active' };
  }

  async createUser(
    email: string,
    password: string,
    accountId: string,
    userData: { firstName: string; lastName: string }
  ): Promise<InternalUser> {
    const hashedPassword = await hashPassword(password);
    
    // Insert with both old and new column names for compatibility
    const insertData: Record<string, unknown> = {
      account_id: accountId,
      email,
      role: 'admin',
      display_name: `${userData.firstName} ${userData.lastName}`.trim(),
    };

    // Try to include new columns (will fail silently if they don't exist)
    // We'll catch and retry without them
    const newColumns = {
      password_hash: hashedPassword,
      first_name: userData.firstName,
      last_name: userData.lastName,
      status: 'active',
    };

    // First try with all columns
    const { data: row, error } = await supabaseAdmin
      .from('admin_users')
      .insert({ ...insertData, ...newColumns })
      .select()
      .single();

    if (error) {
      // If new columns don't exist, retry with old schema only
      if (error.message.includes('column') && error.message.includes('does not exist')) {
        console.warn('[Auth] New columns not found, falling back to old schema');
        const { data: fallbackRow, error: fallbackError } = await supabaseAdmin
          .from('admin_users')
          .insert(insertData)
          .select()
          .single();
        
        if (fallbackError) throw new Error(fallbackError.message);
        return this.mapRow(fallbackRow);
      }
      throw new Error(error.message);
    }

    return this.mapRow(row);
  }

  async updatePassword(userId: string, hashedPassword: string) {
    // Try new schema first
    const { error } = await supabaseAdmin
      .from('admin_users')
      .update({ password_hash: hashedPassword })
      .eq('id', userId);
    
    if (error) {
      if (error.message.includes('column') && error.message.includes('does not exist')) {
        console.warn('[Auth] password_hash column not available. Run migration.');
        throw new Error('Password management requires database migration. Please contact admin.');
      }
      throw new Error(`Failed to update password: ${error.message}`);
    }
  }
}

// ─── Service ─────────────────────────────────────────────────────────────────

export class AuthService {
  private repository = new AuthRepository();

  async register(
    email: string,
    password: string,
    firstName: string,
    lastName: string,
    accountName: string
  ): Promise<AuthResponse> {
    const existingAccount = await this.repository.findAccountByEmail(email);
    if (existingAccount) {
      throw new ConflictError("Account with this email already exists");
    }

    const account = await this.repository.createAccount(email, accountName);

    const user = await this.repository.createUser(email, password, account.id, {
      firstName,
      lastName,
    });

    const tokens = this.generateTokens(user.id, account.id, user.role, email);

    return {
      ...tokens,
      user: this.mapUserToProfile(user),
    };
  }

  async login(email: string, password: string): Promise<AuthResponse> {
    const user = await this.repository.findUserByEmail(email);
    if (!user) {
      console.warn('[AuthService] User not found in admin_users for email:', email);
      throw new AuthenticationError("Invalid email or password");
    }

    // If no password_hash exists, password login is not available
    if (!user.passwordHash) {
      console.warn('[AuthService] No password_hash for user:', email, '- need to set password');
      throw new AuthenticationError(
        "Password login not configured. Please use Google login or contact admin."
      );
    }

    const isValidPassword = await verifyPassword(password, user.passwordHash);
    if (!isValidPassword) {
      console.warn('[AuthService] Invalid password for user:', email);
      throw new AuthenticationError("Invalid email or password");
    }

    console.log('[AuthService] Login successful for:', email, 'accountId:', user.accountId);
    const tokens = this.generateTokens(user.id, user.accountId, user.role, email);

    return {
      ...tokens,
      user: this.mapUserToProfile(user),
    };
  }

  async refreshTokens(refreshToken: string): Promise<TokenPair> {
    let decoded;
    try {
      decoded = this.decodeToken(refreshToken);
    } catch {
      throw new AuthenticationError("Invalid refresh token");
    }

    const user = await this.repository.findUserById(decoded.sub);
    if (!user || user.status !== "active") {
      throw new AuthenticationError("Account is no longer active");
    }

    return this.generateTokens(decoded.sub, decoded.accountId, decoded.role, decoded.email);
  }

  private generateTokens(
    userId: string,
    accountId: string,
    role: string,
    email: string
  ): TokenPair {
    return {
      accessToken: generateAccessToken({ sub: userId, accountId, role, email }),
      refreshToken: generateRefreshToken({ sub: userId, accountId, role, email }),
    };
  }

  private decodeToken(token: string): import('@/lib/utils/jwt').TokenPayload {
    return verifyToken(token);
  }

  private mapUserToProfile(user: InternalUser): UserProfile {
    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      accountId: user.accountId,
      createdAt: user.createdAt,
    };
  }

  async changePassword(userId: string, input: ChangePasswordInput): Promise<void> {
    const user = await this.repository.findUserById(userId);
    if (!user) {
      throw new AuthenticationError("User not found");
    }

    if (!user.passwordHash) {
      throw new AuthenticationError(
        "Password not set. Please contact admin to enable password login."
      );
    }

    const isValidCurrent = await verifyPassword(input.currentPassword, user.passwordHash);
    if (!isValidCurrent) {
      throw new AuthenticationError("Mật khẩu hiện tại không đúng");
    }

    const newHash = await hashPassword(input.newPassword);
    await this.repository.updatePassword(userId, newHash);
  }
}
