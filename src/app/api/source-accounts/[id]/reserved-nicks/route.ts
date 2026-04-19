import { withAccount } from "@/lib/api/with-account";
import { withErrorHandler, createSuccessResponse } from "@/lib/api/with-error-handler";
import { addReservedNick, removeReservedNick } from "@/lib/supabase/repositories/source-accounts.repo";
import { createActivityLog } from "@/lib/supabase/repositories/activity-logs.repo";
import type { NextRequest } from "next/server";

// POST /api/source-accounts/[id]/reserved-nicks — add a nick
export const POST = withErrorHandler(
  withAccount<{ id: string }>(async (request: NextRequest, { accountId, params }) => {
    const { id } = await params;
    const { nick } = await request.json() as { nick: string };
    const updated = await addReservedNick(id, accountId, nick);

    // Log reserved nick addition (non-blocking)
    createActivityLog({
      account_id: accountId,
      action_type: 'RESERVED_NICK_ADDED',
      source_account_id: id,
      details: { nick, used_slots: updated.used_slots, max_slots: updated.max_slots },
    }).catch(() => {});

    return createSuccessResponse(updated);
  })
);

// DELETE /api/source-accounts/[id]/reserved-nicks — remove a nick
export const DELETE = withErrorHandler(
  withAccount<{ id: string }>(async (request: NextRequest, { accountId, params }) => {
    const { id } = await params;
    const { nick } = await request.json() as { nick: string };
    const updated = await removeReservedNick(id, accountId, nick);

    // Log reserved nick removal (non-blocking)
    createActivityLog({
      account_id: accountId,
      action_type: 'RESERVED_NICK_REMOVED',
      source_account_id: id,
      details: { nick, used_slots: updated.used_slots, max_slots: updated.max_slots },
    }).catch(() => {});

    return createSuccessResponse(updated);
  })
);
