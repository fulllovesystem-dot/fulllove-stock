import { useState } from "react";
import { X, Pencil, Trash2, PackagePlus, PackageMinus } from "lucide-react";
import { CATEGORIES, fmtMoney, today, round } from "./data";

const fieldCls = "w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm outline-none focus:border-rose-400";

// 点进一样货物：看它的进货 / 出货记录，直接在这里加进货 / 出货（像 Eternalgy 的 Stock In Records）
export default function ItemDetail({ item, movements, stockOf, actions, onClose, onEditItem }) {
  const [type, setType] = useState(null); // null = 表格收起来，"in" / "out" = 正在填
  const [editing, setEditing] = useState(null);
  const [qty, setQty] = useState("");
  const [date, setDate] = useState(today());
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const cat = CATEGORIES.find((c) => c.id === item.categoryId);
  const mine = movements
    .filter((m) => m.itemId === item.id)
    .sort((a, b) => b.date.localeCompare(a.date) || (a.type === b.type ? 0 : a.type === "in" ? 1 : -1));
  const totalIn = round(mine.filter((m) => m.type === "in").reduce((s, m) => s + m.qty, 0));
  const totalOut = round(mine.filter((m) => m.type === "out").reduce((s, m) => s + m.qty, 0));
  const stock = stockOf(item);

  const openForm = (t) => {
    setEditing(null);
    setType(t);
    setQty("");
    setNote("");
    setDate(today());
  };

  const openEdit = (m) => {
    setEditing(m);
    setType(m.type);
    setQty(String(m.qty));
    setDate(m.date);
    setNote(m.note);
  };

  const closeForm = () => {
    setEditing(null);
    setType(null);
  };

  const submit = async () => {
    const q = parseFloat(qty);
    if (!q || q <= 0) return alert("请填数量 / Please enter a quantity");
    if (!date) return alert("请选日期 / Please pick a date");
    if (busy) return;
    const fields = { itemId: item.id, type, qty: q, price: item.price, date, note: note.trim() };
    setBusy(true);
    const ok = editing ? await actions.updateMovement(editing, { ...editing, ...fields }) : await actions.addMovement(fields);
    setBusy(false);
    if (ok) closeForm();
  };

  const isIn = type === "in";

  return (
    <div className="fixed inset-0 z-20 flex items-start justify-center overflow-y-auto bg-black/40 px-3 py-6" onClick={onClose}>
      <div className="w-full max-w-2xl rounded-2xl bg-white shadow-lg" onClick={(e) => e.stopPropagation()}>
        {/* 货物资料 */}
        <div className="flex items-start justify-between gap-3 border-b border-stone-200 p-5">
          <div>
            <p className="flex items-center gap-1.5 text-xs text-stone-500">
              <span className={`h-2 w-2 rounded-full ${cat?.color ?? "bg-stone-400"}`} />
              {cat?.name ?? "其他 / Other"}
              {item.sub && <span className="rounded-full bg-stone-100 px-2 py-0.5">{item.sub}</span>}
            </p>
            <h2 className="mt-1 text-xl font-bold">{item.name}</h2>
            <p className="text-sm text-stone-500">
              单价 / Unit price：{fmtMoney(item.price)} / {item.unit}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={onEditItem} className="flex items-center gap-1 rounded-lg border border-stone-300 px-3 py-1.5 text-xs hover:bg-stone-50">
              <Pencil size={14} /> 改资料 / Edit
            </button>
            <button onClick={onClose} aria-label="关闭 / Close" className="text-stone-400 hover:text-stone-700">
              <X size={20} />
            </button>
          </div>
        </div>

        {/* 进 / 出 / 库存 */}
        <div className="grid grid-cols-3 gap-3 p-5">
          <Stat label="进货 / In" value={`${totalIn}`} cls="text-emerald-700" />
          <Stat label="出货 / Out" value={`${totalOut}`} cls="text-orange-700" />
          <Stat label="库存 / Stock" value={`${stock} ${item.unit}`} cls={stock <= 0 ? "text-red-600" : "text-rose-700"} />
        </div>

        {/* 加进货 / 出货 */}
        <div className="px-5">
          {type === null ? (
            <div className="flex flex-wrap gap-2">
              <button onClick={() => openForm("in")} className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700">
                <PackagePlus size={16} /> + 进货 / Add Stock In
              </button>
              <button onClick={() => openForm("out")} className="flex items-center gap-1.5 rounded-lg bg-orange-600 px-4 py-2 text-sm font-medium text-white hover:bg-orange-700">
                <PackageMinus size={16} /> + 出货 / Add Stock Out
              </button>
            </div>
          ) : (
            <div className={`rounded-xl border p-4 ${isIn ? "border-emerald-200 bg-emerald-50" : "border-orange-200 bg-orange-50"}`}>
              <h3 className="mb-3 text-sm font-semibold">
                {editing ? (isIn ? "修改进货 / Edit Stock In" : "修改出货 / Edit Stock Out") : isIn ? "进货 / Stock In" : "出货 / Stock Out"}
              </h3>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <label className="text-xs text-stone-500">
                  数量 / Quantity（{item.unit}）*
                  <input autoFocus value={qty} onChange={(e) => setQty(e.target.value)} type="number" min="0" step="any" className={`mt-1 ${fieldCls}`} />
                </label>
                <label className="text-xs text-stone-500">
                  日期 / Date *
                  <input value={date} onChange={(e) => setDate(e.target.value)} type="date" className={`mt-1 ${fieldCls}`} />
                </label>
                <label className="text-xs text-stone-500">
                  备注 / Notes
                  <input value={note} onChange={(e) => setNote(e.target.value)} placeholder={isIn ? "供应商 / Supplier" : "用途 / Purpose"} className={`mt-1 ${fieldCls}`} />
                </label>
              </div>
              <div className="mt-3 flex gap-2">
                <button
                  onClick={submit}
                  disabled={busy}
                  className={`rounded-lg px-5 py-2 text-sm font-medium text-white disabled:opacity-50 ${isIn ? "bg-emerald-600 hover:bg-emerald-700" : "bg-orange-600 hover:bg-orange-700"}`}
                >
                  {editing ? "保存修改 / Save" : isIn ? "确认进货 / Confirm" : "确认出货 / Confirm"}
                </button>
                <button onClick={closeForm} className="rounded-lg border border-stone-300 bg-white px-4 py-2 text-sm text-stone-600 hover:bg-stone-50">
                  取消 / Cancel
                </button>
              </div>
            </div>
          )}
        </div>

        {/* 记录 */}
        <div className="p-5">
          <h3 className="mb-2 text-sm font-semibold text-stone-600">
            进出货记录 / Stock Records（{mine.length}）
          </h3>
          {item.opening !== 0 && (
            <p className="mb-2 text-xs text-stone-400">
              期初库存 / Opening stock：{item.opening} {item.unit}
            </p>
          )}
          {mine.length === 0 ? (
            <p className="rounded-lg border border-dashed border-stone-300 py-6 text-center text-sm text-stone-400">
              还没有记录，按上面的「+ 进货」开始 / No records yet
            </p>
          ) : (
            <ul className="divide-y divide-stone-100 rounded-lg border border-stone-200 text-sm">
              {mine.map((m) => (
                <li key={m.id} className={`flex items-center gap-3 px-3 py-2 ${editing?.id === m.id ? "bg-amber-50" : ""}`}>
                  <span className="w-24 shrink-0 text-stone-500">{m.date}</span>
                  <span className={`w-20 shrink-0 font-semibold ${m.type === "in" ? "text-emerald-700" : "text-orange-700"}`}>
                    {m.type === "in" ? "+" : "-"}
                    {m.qty}
                  </span>
                  <span className="flex-1 truncate text-stone-500">{m.note}</span>
                  <button onClick={() => openEdit(m)} className="text-stone-400 hover:text-rose-600" title="修改 / Edit">
                    <Pencil size={15} />
                  </button>
                  <button
                    onClick={() => {
                      if (confirm(`确定删除这笔记录？\nDelete this record?\n\n${m.date} · ${m.type === "in" ? "进货" : "出货"} ${m.qty}`)) actions.deleteMovement(m);
                    }}
                    className="text-stone-400 hover:text-red-600"
                    title="删除 / Delete"
                  >
                    <Trash2 size={15} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, cls }) {
  return (
    <div className="rounded-xl bg-stone-50 px-4 py-3">
      <p className="text-xs text-stone-500">{label}</p>
      <p className={`text-lg font-bold ${cls}`}>{value}</p>
    </div>
  );
}
