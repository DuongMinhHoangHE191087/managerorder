"use client";

import React, { useMemo, useState } from "react";
import { Check, FolderOpen, Pencil, Plus, Tag, Trash2, X, Users } from "lucide-react";
import { TAG_PALETTE } from "@/lib/constants/colors";
import { vi } from "@/shared/messages/vi";
import {
  useCustomerGroups,
  useCreateGroup,
  useUpdateGroup,
  useDeleteGroup,
} from "@/widgets/pages/customers/hooks/use-customer-groups";
import {
  useCustomerTags,
  useCreateTag,
  useUpdateTag,
  useDeleteTag,
} from "@/widgets/pages/customers/hooks/use-customer-tags";

const PALETTE = TAG_PALETTE;
const text = vi.customers.groupTagManager;

type ActiveTab = "groups" | "tags";

export const GroupTagManager = React.memo(function GroupTagManager() {
  const [tab, setTab] = useState<ActiveTab>("groups");

  return (
    <div className="overflow-hidden rounded-2xl border border-[var(--border-soft)] bg-white shadow-sm">
      <div className="flex border-b border-[var(--border-soft)]">
        {(["groups", "tags"] as const).map((currentTab) => (
          <button
            key={currentTab}
            type="button"
            onClick={() => setTab(currentTab)}
            className={`relative flex flex-1 items-center justify-center gap-2 px-4 py-3.5 text-[13px] font-bold transition-all ${
              tab === currentTab
                ? "bg-[var(--accent)]/5 text-[var(--accent)]"
                : "text-[var(--fg-muted)] hover:bg-gray-50 hover:text-[var(--fg-base)]"
            }`}
          >
            {currentTab === "groups" ? <FolderOpen className="size-4" /> : <Tag className="size-4" />}
            {currentTab === "groups" ? text.tabs.groups : text.tabs.tags}
            {tab === currentTab && (
              <span className="absolute bottom-0 left-4 right-4 h-0.5 rounded-full bg-[var(--accent)]" />
            )}
          </button>
        ))}
      </div>

      <div className="p-5">{tab === "groups" ? <GroupsTab /> : <TagsTab />}</div>
    </div>
  );
});

function GroupsTab() {
  const { data: groups = [], isLoading } = useCustomerGroups();
  const createGroup = useCreateGroup();
  const updateGroup = useUpdateGroup();
  const deleteGroup = useDeleteGroup();

  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState(PALETTE[0]);
  const [newDesc, setNewDesc] = useState("");
  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editColor, setEditColor] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [deleteId, setDeleteId] = useState<string | null>(null);

  async function handleCreate() {
    const trimmed = newName.trim();
    if (!trimmed) {
      return;
    }

    try {
      await createGroup.mutateAsync({
        name: trimmed,
        color: newColor,
        description: newDesc.trim() || undefined,
      });
      setNewName("");
      setNewDesc("");
      setNewColor(PALETTE[Math.floor(Math.random() * PALETTE.length)]);
    } catch {
      // handled by hook
    }
  }

  function startEdit(group: { id: string; name: string; color: string; description: string | null }) {
    setEditId(group.id);
    setEditName(group.name);
    setEditColor(group.color);
    setEditDesc(group.description ?? "");
  }

  async function saveEdit() {
    if (!editId || !editName.trim()) {
      return;
    }

    try {
      await updateGroup.mutateAsync({
        id: editId,
        name: editName.trim(),
        color: editColor,
        description: editDesc.trim() || undefined,
      });
      setEditId(null);
    } catch {
      // handled by hook
    }
  }

  async function confirmDelete() {
    if (!deleteId) {
      return;
    }

    try {
      await deleteGroup.mutateAsync(deleteId);
      setDeleteId(null);
    } catch {
      // handled by hook
    }
  }

  const groupById = useMemo(() => new Map(groups.map((group) => [group.id, group] as const)), [groups]);
  const deletingGroup = deleteId ? groupById.get(deleteId) ?? null : null;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8 text-[13px] text-[var(--fg-muted)]">
        {text.loading}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="space-y-3 rounded-xl bg-[#f8f9fa] p-4">
        <p className="text-[12px] font-bold uppercase tracking-wider text-[var(--fg-base)]">
          {text.groups.createTitle}
        </p>
        <div className="flex gap-2">
          <input
            type="text"
            value={newName}
            onChange={(event) => setNewName(event.target.value)}
            onKeyDown={(event) => event.key === "Enter" && handleCreate()}
            placeholder={text.groups.namePlaceholder}
            className="flex-1 rounded-xl border border-[var(--border-soft)] bg-white px-3 py-2 text-[13px] font-medium outline-none transition-colors focus:border-[var(--accent)]"
          />
          <button
            type="button"
            onClick={handleCreate}
            disabled={!newName.trim() || createGroup.isPending}
            className="flex shrink-0 items-center gap-1.5 rounded-xl bg-[var(--accent)] px-4 py-2 text-[12px] font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            <Plus className="size-3.5" />
            {text.groups.create}
          </button>
        </div>
        <div>
          <p className="mb-1.5 text-[11px] font-bold text-[var(--fg-muted)]">{text.groups.color}</p>
          <div className="flex flex-wrap gap-1.5">
            {PALETTE.map((color) => (
              <button
                key={color}
                type="button"
                onClick={() => setNewColor(color)}
                className={`size-6 rounded-full transition-all ${
                  newColor === color
                    ? "scale-110 ring-2 ring-[var(--accent)] ring-offset-2"
                    : "hover:scale-110"
                }`}
                style={{ backgroundColor: color }}
              />
            ))}
          </div>
        </div>
        <textarea
          value={newDesc}
          onChange={(event) => setNewDesc(event.target.value)}
          placeholder={text.groups.descriptionPlaceholder}
          rows={2}
          className="w-full resize-none rounded-xl border border-[var(--border-soft)] bg-white px-3 py-2 text-[13px] font-medium outline-none transition-colors focus:border-[var(--accent)]"
        />
      </div>

      {groups.length === 0 ? (
        <div className="py-8 text-center">
          <FolderOpen className="mx-auto mb-2 size-10 text-[var(--fg-muted)] opacity-40" />
          <p className="text-[13px] font-medium text-[var(--fg-muted)]">{text.groups.emptyTitle}</p>
          <p className="mt-1 text-[11px] text-[var(--fg-muted)]">{text.groups.emptyDescription}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {groups.map((group) => (
            <div
              key={group.id}
              className="group flex items-center gap-3 rounded-xl border border-[var(--border-soft)] bg-white px-4 py-3 transition-colors hover:border-[var(--accent)]/30"
            >
              {editId === group.id ? (
                <div className="flex-1 space-y-2">
                  <div className="flex gap-2">
                    <input
                      value={editName}
                      onChange={(event) => setEditName(event.target.value)}
                      onKeyDown={(event) => event.key === "Enter" && saveEdit()}
                      className="flex-1 rounded-lg border border-[var(--accent)]/50 bg-[var(--accent)]/5 px-3 py-1.5 text-[13px] font-bold outline-none focus:border-[var(--accent)]"
                      autoFocus
                    />
                    <button
                      type="button"
                      onClick={saveEdit}
                      disabled={updateGroup.isPending}
                      className="rounded-lg p-1.5 text-[var(--accent)] transition-colors hover:bg-[var(--accent)]/10"
                      title={text.groups.edit}
                    >
                      <Check className="size-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditId(null)}
                      className="rounded-lg p-1.5 text-[var(--fg-muted)] transition-colors hover:bg-gray-100"
                      title={text.groups.cancel}
                    >
                      <X className="size-4" />
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {PALETTE.map((color) => (
                      <button
                        key={color}
                        type="button"
                        onClick={() => setEditColor(color)}
                        className={`size-5 rounded-full transition-all ${
                          editColor === color
                            ? "scale-110 ring-2 ring-[var(--accent)] ring-offset-1"
                            : "hover:scale-105"
                        }`}
                        style={{ backgroundColor: color }}
                      />
                    ))}
                  </div>
                  <input
                    value={editDesc}
                    onChange={(event) => setEditDesc(event.target.value)}
                    placeholder={text.groups.descriptionPlaceholder}
                    className="w-full rounded-lg border border-[var(--border-soft)] px-3 py-1.5 text-[12px] outline-none focus:border-[var(--accent)]"
                  />
                </div>
              ) : (
                <>
                  <span className="size-3 shrink-0 rounded-full" style={{ backgroundColor: group.color }} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-[13px] font-bold text-[var(--fg-base)]">{group.name}</span>
                      <span className="flex shrink-0 items-center gap-1 rounded bg-gray-100 px-1.5 py-0.5 text-[11px] font-medium text-[var(--fg-muted)]">
                        <Users className="size-3" />
                        {group.member_count ?? 0}
                      </span>
                    </div>
                    {group.description && (
                      <p className="mt-0.5 truncate text-[11px] text-[var(--fg-muted)]">{group.description}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                    <button
                      type="button"
                      onClick={() => startEdit(group)}
                      className="rounded-lg p-1.5 text-[var(--fg-muted)] transition-colors hover:bg-[var(--accent)]/10 hover:text-[var(--accent)]"
                      title={text.groups.edit}
                    >
                      <Pencil className="size-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeleteId(group.id)}
                      className="rounded-lg p-1.5 text-[var(--fg-muted)] transition-colors hover:bg-[var(--danger)]/10 hover:text-[var(--danger)]"
                      title={text.groups.delete}
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      )}

      {deleteId && (
        <div className="rounded-xl border border-[var(--danger)]/20 bg-[var(--danger)]/5 p-4">
          <p className="mb-1 text-[13px] font-bold text-[var(--danger)]">{text.groups.confirmTitle}</p>
          <p className="mb-3 text-[12px] text-[var(--fg-muted)]">
            {text.groups.confirmDescription(deletingGroup?.name ?? "")}
          </p>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setDeleteId(null)}
              className="rounded-lg border border-[var(--border-soft)] px-3 py-1.5 text-[12px] font-bold text-[var(--fg-muted)] transition-colors hover:bg-gray-50"
            >
              {text.groups.cancel}
            </button>
            <button
              type="button"
              onClick={confirmDelete}
              disabled={deleteGroup.isPending}
              className="rounded-lg bg-[var(--danger)] px-3 py-1.5 text-[12px] font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {deleteGroup.isPending ? text.groups.deleting : text.groups.confirmDelete}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function TagsTab() {
  const { data: tags = [], isLoading } = useCustomerTags();
  const createTag = useCreateTag();
  const updateTag = useUpdateTag();
  const deleteTag = useDeleteTag();

  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState(PALETTE[0]);
  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editColor, setEditColor] = useState("");
  const [deleteId, setDeleteId] = useState<string | null>(null);

  async function handleCreate() {
    const trimmed = newName.trim();
    if (!trimmed) {
      return;
    }

    try {
      await createTag.mutateAsync({ name: trimmed, color: newColor });
      setNewName("");
      setNewColor(PALETTE[Math.floor(Math.random() * PALETTE.length)]);
    } catch {
      // handled by hook
    }
  }

  function startEdit(tag: { id: string; name: string; color: string }) {
    setEditId(tag.id);
    setEditName(tag.name);
    setEditColor(tag.color);
  }

  async function saveEdit() {
    if (!editId || !editName.trim()) {
      return;
    }

    try {
      await updateTag.mutateAsync({ id: editId, name: editName.trim(), color: editColor });
      setEditId(null);
    } catch {
      // handled by hook
    }
  }

  async function confirmDelete() {
    if (!deleteId) {
      return;
    }

    try {
      await deleteTag.mutateAsync(deleteId);
      setDeleteId(null);
    } catch {
      // handled by hook
    }
  }

  const tagById = useMemo(() => new Map(tags.map((tag) => [tag.id, tag] as const)), [tags]);
  const deletingTag = deleteId ? tagById.get(deleteId) ?? null : null;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8 text-[13px] text-[var(--fg-muted)]">
        {text.loading}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="space-y-3 rounded-xl bg-[#f8f9fa] p-4">
        <p className="text-[12px] font-bold uppercase tracking-wider text-[var(--fg-base)]">
          {text.tags.createTitle}
        </p>
        <div className="flex gap-2">
          <input
            type="text"
            value={newName}
            onChange={(event) => setNewName(event.target.value)}
            onKeyDown={(event) => event.key === "Enter" && handleCreate()}
            placeholder={text.tags.namePlaceholder}
            className="flex-1 rounded-xl border border-[var(--border-soft)] bg-white px-3 py-2 text-[13px] font-medium outline-none transition-colors focus:border-[var(--accent)]"
          />
          <button
            type="button"
            onClick={handleCreate}
            disabled={!newName.trim() || createTag.isPending}
            className="flex shrink-0 items-center gap-1.5 rounded-xl bg-[var(--accent)] px-4 py-2 text-[12px] font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            <Plus className="size-3.5" />
            {text.tags.create}
          </button>
        </div>
        <div>
          <p className="mb-1.5 text-[11px] font-bold text-[var(--fg-muted)]">{text.tags.color}</p>
          <div className="flex flex-wrap gap-1.5">
            {PALETTE.map((color) => (
              <button
                key={color}
                type="button"
                onClick={() => setNewColor(color)}
                className={`size-6 rounded-full transition-all ${
                  newColor === color
                    ? "scale-110 ring-2 ring-[var(--accent)] ring-offset-2"
                    : "hover:scale-110"
                }`}
                style={{ backgroundColor: color }}
              />
            ))}
          </div>
        </div>
      </div>

      {tags.length === 0 ? (
        <div className="py-8 text-center">
          <Tag className="mx-auto mb-2 size-10 text-[var(--fg-muted)] opacity-40" />
          <p className="text-[13px] font-medium text-[var(--fg-muted)]">{text.tags.emptyTitle}</p>
          <p className="mt-1 text-[11px] text-[var(--fg-muted)]">{text.tags.emptyDescription}</p>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          {tags.map((tag) => (
            <div key={tag.id} className="group relative">
              {editId === tag.id ? (
                <div className="flex items-center gap-1.5 rounded-xl border border-[var(--accent)]/40 bg-white px-2 py-1.5 shadow-sm">
                  <div className="flex gap-1">
                    {PALETTE.slice(0, 8).map((color) => (
                      <button
                        key={color}
                        type="button"
                        onClick={() => setEditColor(color)}
                        className={`size-4 rounded-full ${
                          editColor === color ? "ring-2 ring-[var(--accent)] ring-offset-1" : ""
                        }`}
                        style={{ backgroundColor: color }}
                      />
                    ))}
                  </div>
                  <input
                    value={editName}
                    onChange={(event) => setEditName(event.target.value)}
                    onKeyDown={(event) => event.key === "Enter" && saveEdit()}
                    className="w-24 rounded-lg border border-[var(--border-soft)] px-2 py-0.5 text-[12px] outline-none focus:border-[var(--accent)]"
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={saveEdit}
                    disabled={updateTag.isPending}
                    className="rounded p-1 text-[var(--accent)] transition-colors hover:bg-[var(--accent)]/10"
                    title={text.tags.edit}
                  >
                    <Check className="size-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditId(null)}
                    className="rounded p-1 text-[var(--fg-muted)] transition-colors hover:bg-gray-100"
                    title={text.tags.cancel}
                  >
                    <X className="size-3.5" />
                  </button>
                </div>
              ) : (
                <div
                  className="inline-flex cursor-default items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12px] font-bold transition-all"
                  style={{
                    backgroundColor: `${tag.color}12`,
                    color: tag.color,
                    borderColor: `${tag.color}30`,
                  }}
                >
                  <span className="size-2.5 rounded-full" style={{ backgroundColor: tag.color }} />
                  {tag.name}
                  <div className="ml-1 flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                    <button
                      type="button"
                      onClick={() => startEdit(tag)}
                      className="rounded p-0.5 transition-colors hover:bg-black/5"
                      title={text.tags.edit}
                    >
                      <Pencil className="size-3" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeleteId(tag.id)}
                      className="rounded p-0.5 transition-colors hover:bg-black/5"
                      title={text.tags.delete}
                    >
                      <Trash2 className="size-3" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {deleteId && (
        <div className="rounded-xl border border-[var(--danger)]/20 bg-[var(--danger)]/5 p-4">
          <p className="mb-1 text-[13px] font-bold text-[var(--danger)]">{text.tags.confirmTitle}</p>
          <p className="mb-3 text-[12px] text-[var(--fg-muted)]">
            {text.tags.confirmDescription(deletingTag?.name ?? "")}
          </p>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setDeleteId(null)}
              className="rounded-lg border border-[var(--border-soft)] px-3 py-1.5 text-[12px] font-bold text-[var(--fg-muted)] transition-colors hover:bg-gray-50"
            >
              {text.tags.cancel}
            </button>
            <button
              type="button"
              onClick={confirmDelete}
              disabled={deleteTag.isPending}
              className="rounded-lg bg-[var(--danger)] px-3 py-1.5 text-[12px] font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {deleteTag.isPending ? text.tags.deleting : text.tags.confirmDelete}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
