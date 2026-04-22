import { NextRequest, NextResponse } from "next/server";
import type { Database } from "@/lib/supabase/database.types";
import {
  listCalendarEvents,
  createCalendarEvent,
  updateCalendarEvent,
  deleteCalendarEvent,
} from "@/lib/supabase/repositories/calendar.repo";
import { mapCalendarEventRow } from "@/lib/supabase/mappers";
import { withAccount } from "@/lib/api/with-account";
import { withErrorHandler } from "@/lib/api/with-error-handler";
import { createCalendarEventSchema, updateCalendarEventSchema } from "@/lib/domain/schemas";
import { createActivityLog } from "@/lib/supabase/repositories/activity-logs.repo";
import { syncEventToGCal, type GCalSyncResult } from "@/lib/integrations/google-calendar";

type EventType = Database['public']['Tables']['reminder_events']['Row']['type'];

export const dynamic = "force-dynamic";

export const GET = withErrorHandler(
  withAccount(async (request: NextRequest, { accountId }) => {
    const rows = await listCalendarEvents(accountId);
    const data = rows.map(r => mapCalendarEventRow(r));
    return NextResponse.json({ data });
  })
);

export const POST = withErrorHandler(
  withAccount(async (request: NextRequest, { accountId }) => {
    const body = await request.json();
    const validatedData = createCalendarEventSchema.parse(body);
    
    // Combine date + optional time into ISO due_at
    const due_at = validatedData.time ? `${validatedData.date}T${validatedData.time}:00` : `${validatedData.date}T00:00:00`;
    
    const result = await createCalendarEvent(accountId, {
      title: validatedData.title,
      due_at,
      type: (validatedData.type as EventType) ?? 'follow_up',
      is_done: validatedData.is_done ?? false,
      customer_ids: validatedData.customerIds ?? [],
      notes: validatedData.notes,
      has_reminder: validatedData.hasReminder ?? false,
    });
    
    // Activity Log
    createActivityLog({
      account_id: accountId,
      action_type: 'CALENDAR_EVENT_CREATED',
      details: {
        event_id: result.id,
        title: validatedData.title,
        type: validatedData.type
      }
    }).catch(() => {});

    // GCal Sync — structured result
    const gcalResult: GCalSyncResult = await syncEventToGCal(
      accountId,
      {
        id: result.id,
        title: result.title,
        due_at: result.due_at,
        notes: result.notes || undefined,
        is_done: result.is_done,
        gcal_event_id: null,
      },
      "create"
    );

    if (gcalResult.gcalEventId) {
      await updateCalendarEvent(result.id, accountId, { gcal_event_id: gcalResult.gcalEventId });
      result.gcal_event_id = gcalResult.gcalEventId;
    }

    return NextResponse.json({
      data: mapCalendarEventRow(result),
      gcalSyncStatus: gcalResult.status,
      gcalSyncError: gcalResult.error,
    }, { status: 201 });
  })
);

export const DELETE = withErrorHandler(
  withAccount(async (request: NextRequest, { accountId }) => {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    
    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }
    
    // get the event first so we can find gcal_event_id if any (needed for deletion on Google side)
    const rows = await listCalendarEvents(accountId);
    const targetEvent = rows.find(r => r.id === id);
    
    if (!targetEvent) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }
    
    await deleteCalendarEvent(id, accountId);

    if (targetEvent.gcal_event_id) {
      await syncEventToGCal(
        accountId,
        {
          id: targetEvent.id,
          title: targetEvent.title,
          due_at: targetEvent.due_at,
          gcal_event_id: targetEvent.gcal_event_id,
        },
        "delete"
      );
    }
    
    // Activity Log
    await createActivityLog({
      account_id: accountId,
      action_type: 'CALENDAR_EVENT_DELETED',
      details: { event_id: id }
    });

    return NextResponse.json({ success: true });
  })
);

export const PATCH = withErrorHandler(
  withAccount(async (request: NextRequest, { accountId }) => {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    
    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }
    
    const body = await request.json();
    const validatedData = updateCalendarEventSchema.parse(body);
    
    // If date/time is provided, we need to rebuild due_at
    let due_at = undefined;
    if (validatedData.date) {
      due_at = validatedData.time ? `${validatedData.date}T${validatedData.time}:00` : `${validatedData.date}T00:00:00`;
    }
    
    const updatePayload: Parameters<typeof updateCalendarEvent>[2] = {
      is_done: validatedData.is_done,
      title: validatedData.title,
      due_at,
      type: validatedData.type as EventType,
      customer_ids: validatedData.customerIds,
      notes: validatedData.notes,
      has_reminder: validatedData.hasReminder,
    };
    
    const result = await updateCalendarEvent(id, accountId, updatePayload);
    
    // Activity Log
    await createActivityLog({
      account_id: accountId,
      action_type: 'CALENDAR_EVENT_UPDATED',
      details: {
        event_id: id,
        updates: validatedData
      }
    });

    // GCal Sync — structured result
    let gcalResult: GCalSyncResult;
    if (result.gcal_event_id) {
      gcalResult = await syncEventToGCal(
        accountId,
        {
          id: result.id,
          title: result.title,
          due_at: result.due_at,
          notes: result.notes || undefined,
          is_done: result.is_done,
          gcal_event_id: result.gcal_event_id,
        },
        "update"
      );
    } else {
      // Not synced yet, try to create
      gcalResult = await syncEventToGCal(
        accountId,
        {
          id: result.id,
          title: result.title,
          due_at: result.due_at,
          notes: result.notes || undefined,
          is_done: result.is_done,
          gcal_event_id: null,
        },
        "create"
      );
      if (gcalResult.gcalEventId) {
        await updateCalendarEvent(result.id, accountId, { gcal_event_id: gcalResult.gcalEventId });
        result.gcal_event_id = gcalResult.gcalEventId;
      }
    }

    return NextResponse.json({
      data: mapCalendarEventRow(result as unknown as Record<string, unknown>),
      gcalSyncStatus: gcalResult.status,
      gcalSyncError: gcalResult.error,
    });
  })
);
