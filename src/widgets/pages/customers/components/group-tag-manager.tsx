"use client";

import React from "react";
import { useState } from "react";
import { Plus, Trash2, Pencil, Check, X, Users, Tag, FolderOpen } from "lucide-react";
import { TAG_PALETTE } from "@/lib/constants/colors";
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

type ActiveTab = "groups" | "tags";

export const GroupTagManager = React.memo(function GroupTagManager() {
  const [tab, setTab] = useState<ActiveTab>("groups");

  return (
    <div className="bg-white border border-[var(--border-soft)] rounded-2xl shadow-sm overflow-hidden">
      {/* Tab Header */}
      <div className="flex border-b border-[var(--border-soft)]">
        {(["groups", "tags"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-3.5 text-[13px] font-bold transition-all relative ${
              tab === t
                ? "text-[var(--accent)] bg-[var(--accent)]/5"
                : "text-[var(--fg-muted)] hover:text-[var(--fg-base)] hover:bg-gray-50"
            }`}
          >
            {t === "groups" ? <FolderOpen className="size-4" /> : <Tag className="size-4" />}
            {t === "groups" ? "Nhóm" : "Tags"}
            {tab === t && (
              <span className="absolute bottom-0 left-4 right-4 h-0.5 bg-[var(--accent)] rounded-full" />
            )}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="p-5">
        {tab === "groups" ? <GroupsTab /> : <TagsTab />}
      </div>
    </div>
  );
});

/* ─── Groups Tab ────────────────────────────────────── */
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
    if (!trimmed) return;
    try {
      await createGroup.mutateAsync({ name: trimmed, color: newColor, description: newDesc.trim() || undefined });
      setNewName("");
      setNewDesc("");
      setNewColor(PALETTE[Math.floor(Math.random() * PALETTE.length)]);
    } catch {
      // handled by hook
    }
  }

  function startEdit(g: { id: string; name: string; color: string; description: string | null }) {
    setEditId(g.id);
    setEditName(g.name);
    setEditColor(g.color);
    setEditDesc(g.description ?? "");
  }

  async function saveEdit() {
    if (!editId || !editName.trim()) return;
    try {
      await updateGroup.mutateAsync({ id: editId, name: editName.trim(), color: editColor, description: editDesc.trim() || undefined });
      setEditId(null);
    } catch {
      // handled by hook
    }
  }

  async function confirmDelete() {
    if (!deleteId) return;
    try {
      await deleteGroup.mutateAsync(deleteId);
      setDeleteId(null);
    } catch {
      // handled by hook
    }
  }

  if (isLoading) {
    return <div className="flex items-center justify-center py-8 text-[var(--fg-muted)] text-[13px]">Đang tải...</div>;
  }

  return (
    <div className="space-y-5">
      {/* Create Form */}
      <div className="bg-[#f8f9fa] rounded-xl p-4 space-y-3">
        <p className="text-[12px] font-bold text-[var(--fg-base)] uppercase tracking-wider">Tạo nhóm mới</p>
        <div className="flex gap-2">
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleCreate()}
            placeholder="Tên nhóm..."
            className="flex-1 px-3 py-2 border border-[var(--border-soft)] rounded-xl text-[13px] font-medium outline-none focus:border-[var(--accent)] bg-white transition-colors"
          />
          <button
            onClick={handleCreate}
            disabled={!newName.trim() || createGroup.isPending}
            className="px-4 py-2 bg-[var(--accent)] text-white rounded-xl text-[12px] font-bold disabled:opacity-50 flex items-center gap-1.5 shrink-0 hover:opacity-90 transition-opacity"
          >
            <Plus className="size-3.5" />
            Tạo
          </button>
        </div>
        <div>
          <p className="text-[11px] font-bold text-[var(--fg-muted)] mb-1.5">Màu sắc</p>
          <div className="flex gap-1.5 flex-wrap">
            {PALETTE.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setNewColor(c)}
                className={`size-6 rounded-full transition-all ${
                  newColor === c ? "ring-2 ring-offset-2 ring-[var(--accent)] scale-110" : "hover:scale-110"
                }`}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
        </div>
        <textarea
          value={newDesc}
          onChange={(e) => setNewDesc(e.target.value)}
          placeholder="Mô tả nhóm (tùy chọn)..."
          rows={2}
          className="w-full px-3 py-2 border border-[var(--border-soft)] rounded-xl text-[13px] font-medium outline-none focus:border-[var(--accent)] bg-white resize-none transition-colors"
        />
      </div>

      {/* Groups List */}
      {groups.length === 0 ? (
        <div className="text-center py-8">
          <FolderOpen className="size-10 text-[var(--fg-muted)] opacity-40 mx-auto mb-2" />
          <p className="text-[13px] text-[var(--fg-muted)] font-medium">Chưa có nhóm nào</p>
          <p className="text-[11px] text-[var(--fg-muted)] mt-1">Tạo nhóm đầu tiên ở trên</p>
        </div>
      ) : (
        <div className="space-y-2">
          {groups.map((g) => (
            <div
              key={g.id}
              className="flex items-center gap-3 px-4 py-3 bg-white border border-[var(--border-soft)] rounded-xl hover:border-[var(--accent)]/30 transition-colors group"
            >
              {editId === g.id ? (
                /* Editing mode */
                <div className="flex-1 space-y-2">
                  <div className="flex gap-2">
                    <input
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && saveEdit()}
                      className="flex-1 px-3 py-1.5 border border-[var(--accent)]/50 rounded-lg text-[13px] font-bold outline-none focus:border-[var(--accent)] bg-[var(--accent)]/5"
                      autoFocus
                    />
                    <button onClick={saveEdit} disabled={updateGroup.isPending} className="p-1.5 text-[var(--accent)] hover:bg-[var(--accent)]/10 rounded-lg transition-colors">
                      <Check className="size-4" />
                    </button>
                    <button onClick={() => setEditId(null)} className="p-1.5 text-[var(--fg-muted)] hover:bg-gray-100 rounded-lg transition-colors">
                      <X className="size-4" />
                    </button>
                  </div>
                  <div className="flex gap-1.5 flex-wrap">
                    {PALETTE.map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setEditColor(c)}
                        className={`size-5 rounded-full transition-all ${
                          editColor === c ? "ring-2 ring-offset-1 ring-[var(--accent)] scale-110" : "hover:scale-105"
                        }`}
                        style={{ backgroundColor: c }}
                      />
                    ))}
                  </div>
                  <input
                    value={editDesc}
                    onChange={(e) => setEditDesc(e.target.value)}
                    placeholder="Mô tả..."
                    className="w-full px-3 py-1.5 border border-[var(--border-soft)] rounded-lg text-[12px] outline-none focus:border-[var(--accent)]"
                  />
                </div>
              ) : (
                /* Display mode */
                <>
                  <span className="size-3 rounded-full shrink-0" style={{ backgroundColor: g.color }} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-[13px] text-[var(--fg-base)] truncate">{g.name}</span>
                      <span className="text-[11px] text-[var(--fg-muted)] bg-gray-100 px-1.5 py-0.5 rounded font-medium flex items-center gap-1 shrink-0">
                        <Users className="size-3" />
                        {g.member_count ?? 0}
                      </span>
                    </div>
                    {g.description && (
                      <p className="text-[11px] text-[var(--fg-muted)] mt-0.5 truncate">{g.description}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => startEdit(g)}
                      className="p-1.5 text-[var(--fg-muted)] hover:text-[var(--accent)] hover:bg-[var(--accent)]/10 rounded-lg transition-colors"
                      title="Sửa"
                    >
                      <Pencil className="size-3.5" />
                    </button>
                    <button
                      onClick={() => setDeleteId(g.id)}
                      className="p-1.5 text-[var(--fg-muted)] hover:text-[var(--danger)] hover:bg-[var(--danger)]/10 rounded-lg transition-colors"
                      title="Xóa"
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

      {/* Delete confirmation inline */}
      {deleteId && (
        <div className="bg-[var(--danger)]/5 border border-[var(--danger)]/20 rounded-xl p-4">
          <p className="text-[13px] font-bold text-[var(--danger)] mb-1">Xác nhận xóa nhóm?</p>
          <p className="text-[12px] text-[var(--fg-muted)] mb-3">
            Các khách hàng thuộc nhóm sẽ được gỡ khỏi nhóm (không bị xóa).
          </p>
          <div className="flex gap-2 justify-end">
            <button
              onClick={() => setDeleteId(null)}
              className="px-3 py-1.5 text-[12px] font-bold text-[var(--fg-muted)] border border-[var(--border-soft)] rounded-lg hover:bg-gray-50 transition-colors"
            >
              Hủy
            </button>
            <button
              onClick={confirmDelete}
              disabled={deleteGroup.isPending}
              className="px-3 py-1.5 text-[12px] font-bold text-white bg-[var(--danger)] rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {deleteGroup.isPending ? "Đang xóa..." : "Xóa nhóm"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Tags Tab ─────────────────────────────────────── */
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
    if (!trimmed) return;
    try {
      await createTag.mutateAsync({ name: trimmed, color: newColor });
      setNewName("");
      setNewColor(PALETTE[Math.floor(Math.random() * PALETTE.length)]);
    } catch {
      // handled by hook
    }
  }

  function startEdit(t: { id: string; name: string; color: string }) {
    setEditId(t.id);
    setEditName(t.name);
    setEditColor(t.color);
  }

  async function saveEdit() {
    if (!editId || !editName.trim()) return;
    try {
      await updateTag.mutateAsync({ id: editId, name: editName.trim(), color: editColor });
      setEditId(null);
    } catch {
      // handled by hook
    }
  }

  async function confirmDelete() {
    if (!deleteId) return;
    try {
      await deleteTag.mutateAsync(deleteId);
      setDeleteId(null);
    } catch {
      // handled by hook
    }
  }

  if (isLoading) {
    return <div className="flex items-center justify-center py-8 text-[var(--fg-muted)] text-[13px]">Đang tải...</div>;
  }

  return (
    <div className="space-y-5">
      {/* Create Form */}
      <div className="bg-[#f8f9fa] rounded-xl p-4 space-y-3">
        <p className="text-[12px] font-bold text-[var(--fg-base)] uppercase tracking-wider">Tạo tag mới</p>
        <div className="flex gap-2">
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleCreate()}
            placeholder="Tên tag..."
            className="flex-1 px-3 py-2 border border-[var(--border-soft)] rounded-xl text-[13px] font-medium outline-none focus:border-[var(--accent)] bg-white transition-colors"
          />
          <button
            onClick={handleCreate}
            disabled={!newName.trim() || createTag.isPending}
            className="px-4 py-2 bg-[var(--accent)] text-white rounded-xl text-[12px] font-bold disabled:opacity-50 flex items-center gap-1.5 shrink-0 hover:opacity-90 transition-opacity"
          >
            <Plus className="size-3.5" />
            Tạo
          </button>
        </div>
        <div>
          <p className="text-[11px] font-bold text-[var(--fg-muted)] mb-1.5">Màu sắc</p>
          <div className="flex gap-1.5 flex-wrap">
            {PALETTE.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setNewColor(c)}
                className={`size-6 rounded-full transition-all ${
                  newColor === c ? "ring-2 ring-offset-2 ring-[var(--accent)] scale-110" : "hover:scale-110"
                }`}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Tags List */}
      {tags.length === 0 ? (
        <div className="text-center py-8">
          <Tag className="size-10 text-[var(--fg-muted)] opacity-40 mx-auto mb-2" />
          <p className="text-[13px] text-[var(--fg-muted)] font-medium">Chưa có tag nào</p>
          <p className="text-[11px] text-[var(--fg-muted)] mt-1">Tạo tag đầu tiên ở trên</p>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          {tags.map((t) => (
            <div key={t.id} className="group relative">
              {editId === t.id ? (
                <div className="flex items-center gap-1.5 bg-white border border-[var(--accent)]/40 rounded-xl px-2 py-1.5 shadow-sm">
                  <div className="flex gap-1">
                    {PALETTE.slice(0, 8).map((c) => (
                      <button
                        key={c}
                        onClick={() => setEditColor(c)}
                        className={`size-4 rounded-full ${editColor === c ? "ring-2 ring-offset-1 ring-[var(--accent)]" : ""}`}
                        style={{ backgroundColor: c }}
                      />
                    ))}
                  </div>
                  <input
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && saveEdit()}
                    className="w-24 px-2 py-0.5 border border-[var(--border-soft)] rounded-lg text-[12px] outline-none focus:border-[var(--accent)]"
                    autoFocus
                  />
                  <button onClick={saveEdit} disabled={updateTag.isPending} className="p-1 text-[var(--accent)] hover:bg-[var(--accent)]/10 rounded">
                    <Check className="size-3.5" />
                  </button>
                  <button onClick={() => setEditId(null)} className="p-1 text-[var(--fg-muted)] hover:bg-gray-100 rounded">
                    <X className="size-3.5" />
                  </button>
                </div>
              ) : (
                <div
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px] font-bold cursor-default transition-all border"
                  style={{
                    backgroundColor: `${t.color}12`,
                    color: t.color,
                    borderColor: `${t.color}30`,
                  }}
                >
                  <span className="size-2.5 rounded-full" style={{ backgroundColor: t.color }} />
                  {t.name}
                  <div className="flex items-center gap-0.5 ml-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => startEdit(t)}
                      className="p-0.5 hover:bg-black/5 rounded"
                      title="Sửa"
                    >
                      <Pencil className="size-3" />
                    </button>
                    <button
                      onClick={() => setDeleteId(t.id)}
                      className="p-0.5 hover:bg-black/5 rounded"
                      title="Xóa"
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

      {/* Delete confirmation inline */}
      {deleteId && (
        <div className="bg-[var(--danger)]/5 border border-[var(--danger)]/20 rounded-xl p-4">
          <p className="text-[13px] font-bold text-[var(--danger)] mb-1">Xác nhận xóa tag?</p>
          <p className="text-[12px] text-[var(--fg-muted)] mb-3">
            Tag sẽ bị gỡ khỏi tất cả khách hàng đang được gắn.
          </p>
          <div className="flex gap-2 justify-end">
            <button
              onClick={() => setDeleteId(null)}
              className="px-3 py-1.5 text-[12px] font-bold text-[var(--fg-muted)] border border-[var(--border-soft)] rounded-lg hover:bg-gray-50 transition-colors"
            >
              Hủy
            </button>
            <button
              onClick={confirmDelete}
              disabled={deleteTag.isPending}
              className="px-3 py-1.5 text-[12px] font-bold text-white bg-[var(--danger)] rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {deleteTag.isPending ? "Đang xóa..." : "Xóa tag"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
