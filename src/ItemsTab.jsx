import { useState } from "react";
import { Plus, Pencil, Trash2, X, Lock } from "lucide-react";
import { CATEGORIES, SUBCATEGORIES, fmtMoney } from "./data";
import { verifyOwnPassword } from "./accounts";

const fieldCls = "w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm outline-none focus:border-rose-400";

// 进入货物资料页面前，再输入一次自己的 PIN / 密码
export function ItemsLock({ me, onUnlock }) {
  const [pin, setPin] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setErr("");
    try {
      await verifyOwnPassword(pin);
      onUnlock();
    } catch (x) {
      setErr(x?.message || "错误 / Error");
    }
    setBusy(false);
  };

  return (
    <form onSubmit={submit} className="mx-auto mt-10 max-w-sm space-y-3 rounded-2xl bg-white p-6 shadow-sm">
      <h2 className="flex items-center gap-2 font-semibold">
        <Lock size={18} className="text-rose-600" /> 货物资料 / Items
      </h2>
      <p className="text-sm text-stone-500">
        请再输入一次你的{me.isAdmin ? "密码" : " PIN"}才能进入 / Enter your {me.isAdmin ? "password" : "PIN"} to continue
      </p>
      <input
        autoFocus
        type="password"
        inputMode={me.isAdmin ? undefined : "numeric"}
        value={pin}
        onChange={(e) => setPin(e.target.value)}
        className={fieldCls}
        placeholder={me.isAdmin ? "密码 / Password" : "PIN"}
        required
      />
      {err && <p className="text-sm text-rose-600">{err}</p>}
      <button disabled={busy} className="w-full rounded-lg bg-rose-600 py-2 text-sm font-semibold text-white hover:bg-rose-700 disabled:opacity-50">
        进入 / Enter
      </button>
    </form>
  );
}

// 货物资料：先选部门，再新增 / 修改 / 删除这个部门的货物
export default function ItemsTab({ allItems, movements, stockOf, actions }) {
  const [catId, setCatId] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [busy, setBusy] = useState(false);
  const [f, setF] = useState({ name: "", sub: "", unit: "", price: "", opening: "" });

  const cat = CATEGORIES.find((c) => c.id === catId);
  const list = allItems
    .filter((i) => i.categoryId === catId)
    .sort((a, b) => (a.sub ?? "").localeCompare(b.sub ?? "", "zh") || a.name.localeCompare(b.name, "zh"));

  const resetForm = () => {
    setEditing(null);
    setShowForm(false);
    setF({ name: "", sub: "", unit: "", price: "", opening: "" });
  };

  const openNew = () => {
    resetForm();
    setShowForm(true);
  };

  const openEdit = (i) => {
    setEditing(i);
    setShowForm(true);
    setF({ name: i.name, sub: i.sub, unit: i.unit, price: String(i.price), opening: String(i.opening), categoryId: i.categoryId });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const submit = async (e) => {
    e?.preventDefault();
    if (!f.name.trim() || busy) return;
    const dup = allItems.find(
      (i) => i.id !== editing?.id && i.categoryId === (f.categoryId ?? catId) && i.name.trim() === f.name.trim() && (i.sub ?? "") === f.sub.trim()
    );
    if (dup && !confirm(`这个部门已经有「${f.name.trim()}」，还要再加吗？\nAn item with this name already exists. Add anyway?`)) return;
    const fields = {
      categoryId: editing ? f.categoryId ?? editing.categoryId : catId,
      sub: f.sub.trim(),
      name: f.name.trim(),
      unit: f.unit.trim() || "个",
      price: parseFloat(f.price) || 0,
      opening: parseFloat(f.opening) || 0,
    };
    setBusy(true);
    const ok = editing ? await actions.updateItem(editing, { ...editing, ...fields }) : await actions.addItem(fields);
    setBusy(false);
    if (!ok) return;
    if (editing) {
      resetForm();
    } else {
      // 连续新增：保留表格，清空名字，方便一直 key in
      setF((x) => ({ ...x, name: "", price: "" }));
    }
  };

  /* 第一步：选部门 */
  if (!cat) {
    return (
      <div>
        <h2 className="mb-1 text-lg font-semibold">选择部门 / Choose a department</h2>
        <p className="mb-4 text-sm text-stone-500">选好部门，再新增或修改这个部门的货物 / Pick a department to add or edit its items</p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {CATEGORIES.map((c) => {
            const n = allItems.filter((i) => i.categoryId === c.id).length;
            return (
              <button
                key={c.id}
                onClick={() => setCatId(c.id)}
                className="rounded-xl border border-stone-200 bg-white p-4 text-left shadow-sm hover:border-rose-300 hover:bg-rose-50"
              >
                <span className="flex items-center gap-2 font-medium">
                  <span className={`h-3 w-3 rounded-full ${c.color}`} />
                  {c.name}
                </span>
                <span className="mt-1 block text-xs text-stone-500">{c.examples}</span>
                <span className="mt-2 block text-sm font-semibold text-stone-700">{n} 样货物 / items</span>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  /* 第二步：这个部门的货物 */
  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <button
          onClick={() => {
            resetForm();
            setCatId(null);
          }}
          className="rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm hover:bg-stone-50"
        >
          ← 换部门 / Change department
        </button>
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <span className={`h-3 w-3 rounded-full ${cat.color}`} />
          {cat.name}
        </h2>
        <button
          onClick={openNew}
          className="ml-auto flex items-center gap-1.5 rounded-lg bg-rose-600 px-4 py-2.5 text-sm font-medium text-white shadow hover:bg-rose-700"
        >
          <Plus size={16} /> 新增货物 / Add Item
        </button>
      </div>

      {showForm && (
        <form onSubmit={submit} className="mb-4 rounded-xl border border-rose-200 bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="font-semibold">{editing ? "修改货物 / Edit Item" : `新增货物到「${cat.name}」 / Add Item`}</h3>
            <button type="button" onClick={resetForm} aria-label="关闭 / Close" className="text-stone-400 hover:text-stone-600">
              <X size={18} />
            </button>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Field label="货物名称 / Item Name *">
              <input autoFocus value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="例如 / e.g. 白米" className={fieldCls} />
            </Field>
            <Field label="小分类 / Subcategory">
              <input value={f.sub} onChange={(e) => setF({ ...f, sub: e.target.value })} placeholder="可不填 / Optional" list={`subs-${catId}`} className={fieldCls} />
              <datalist id={`subs-${catId}`}>
                {(SUBCATEGORIES[catId] ?? []).map((x) => (
                  <option key={x} value={x} />
                ))}
              </datalist>
            </Field>
            <Field label="单位 / Unit">
              <input value={f.unit} onChange={(e) => setF({ ...f, unit: e.target.value })} placeholder="包、kg、罐、套" className={fieldCls} />
            </Field>
            <Field label="单价 / Unit Price (RM)">
              <input value={f.price} onChange={(e) => setF({ ...f, price: e.target.value })} type="number" min="0" step="0.01" placeholder="0.00" className={fieldCls} />
            </Field>
            {editing && (
              <Field label="部门 / Department">
                <select value={f.categoryId} onChange={(e) => setF({ ...f, categoryId: e.target.value })} className={fieldCls}>
                  {CATEGORIES.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </Field>
            )}
            {editing && Number(f.opening) !== 0 && (
              <Field label="期初库存 / Opening Stock（旧资料）">
                <input value={f.opening} onChange={(e) => setF({ ...f, opening: e.target.value })} type="number" min="0" step="any" className={fieldCls} />
              </Field>
            )}
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <button disabled={busy} className="rounded-lg bg-rose-600 px-5 py-2 text-sm font-medium text-white hover:bg-rose-700 disabled:opacity-50">
              {editing ? "保存修改 / Save Changes" : "保存 / Save"}
            </button>
            {!editing && (
              <span className="text-xs text-stone-500">
                保存后可以继续 key in 下一样；库存数量在「库存」页面按「进 / 出货」输入 / Stock quantities are entered from the Stock page
              </span>
            )}
          </div>
        </form>
      )}

      {list.length === 0 ? (
        <div className="rounded-xl border border-dashed border-stone-300 bg-white/60 py-16 text-center text-sm text-stone-400">
          这个部门还没有货物 / No items in this department yet
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl bg-white shadow-sm">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b border-stone-200 text-left text-xs uppercase tracking-wide text-stone-500">
                <th className="px-4 py-3">货物 / Item</th>
                <th className="px-4 py-3">单位 / Unit</th>
                <th className="px-4 py-3 text-right">单价 / Unit Price</th>
                <th className="px-4 py-3 text-right">库存 / Stock</th>
                <th className="px-4 py-3 text-right">操作 / Actions</th>
              </tr>
            </thead>
            <tbody>
              {list.map((i) => (
                <tr key={i.id} className={`border-b border-stone-100 last:border-0 hover:bg-stone-50 ${editing?.id === i.id ? "bg-amber-50" : ""}`}>
                  <td className="px-4 py-3 font-medium">
                    {i.name}
                    {i.sub && <span className="ml-2 rounded-full bg-stone-100 px-2 py-0.5 text-xs font-normal text-stone-500">{i.sub}</span>}
                  </td>
                  <td className="px-4 py-3 text-stone-600">{i.unit}</td>
                  <td className="px-4 py-3 text-right">
                    <PriceInput item={i} onSave={(p) => actions.updateItem(i, { ...i, price: p })} />
                  </td>
                  <td className="px-4 py-3 text-right text-stone-600">
                    {stockOf(i)} {i.unit}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-3">
                      <button onClick={() => openEdit(i)} className="text-stone-400 hover:text-rose-600" title="修改 / Edit">
                        <Pencil size={16} />
                      </button>
                      <button
                        onClick={() => {
                          const n = movements.filter((m) => m.itemId === i.id).length;
                          if (confirm(`确定删除「${i.name}」？${n ? `它的 ${n} 笔进出货记录也会删除。` : ""}\nDelete this item${n ? " and its stock records" : ""}?`)) actions.deleteItem(i);
                        }}
                        className="text-stone-400 hover:text-red-600"
                        title="删除 / Delete"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="px-4 py-2 text-xs text-stone-400">
            {list.length} 样货物 / items · 单价可以直接点一下修改 / Click a price to edit · 库存价值 / Stock value：
            {fmtMoney(list.reduce((s, i) => s + stockOf(i) * i.price, 0))}
          </p>
        </div>
      )}
    </div>
  );
}

function Field({ label, children }) {
  return (
    <label className="block text-xs font-medium text-stone-500">
      {label}
      <div className="mt-1">{children}</div>
    </label>
  );
}

// 表格里直接改单价：离开格子或按 Enter 才保存
function PriceInput({ item, onSave }) {
  const [v, setV] = useState(null);
  const shown = v ?? String(item.price);
  const commit = () => {
    if (v === null) return;
    const p = parseFloat(v) || 0;
    setV(null);
    if (p !== item.price) onSave(p);
  };
  return (
    <input
      type="number"
      min="0"
      step="0.01"
      value={shown}
      onChange={(e) => setV(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
      title="点一下就可以改单价 / Click to edit price"
      className="w-24 rounded border border-transparent px-2 py-1 text-right text-sm hover:border-stone-300 focus:border-rose-400 focus:outline-none"
    />
  );
}
