import { useEffect, useState } from "react";
import {
  collection,
  doc,
  onSnapshot,
  writeBatch,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "./firebase";

export const CATEGORIES = [
  { id: "kitchen", name: "厨房用品 / Kitchen Supplies", examples: "干粮、米、酒、罐头、面、粉、酱", color: "bg-amber-500" },
  { id: "food", name: "食材用品 / Food Ingredients", examples: "鱼、猪肉、鸡肉、冷冻食品", color: "bg-rose-500" },
  { id: "herbal", name: "药膳用品 / Herbal Supplies", examples: "药材、汤包、补品", color: "bg-emerald-600" },
  { id: "baby", name: "婴儿用品 / Baby Supplies", examples: "尿布、湿巾、奶瓶", color: "bg-sky-500" },
  { id: "mom", name: "妈咪用品 / Maternity Supplies", examples: "卫生用品、哺乳用品", color: "bg-fuchsia-500" },
  { id: "gift", name: "赠送用品 / Gift Supplies", examples: "礼品、赠品", color: "bg-violet-500" },
  { id: "milk", name: "奶粉用品 / Milk Formula", examples: "奶粉、辅食", color: "bg-orange-500" },
  { id: "cleaning", name: "清洁用品 / Cleaning Supplies", examples: "洗洁精、漂白水、抹布、垃圾袋", color: "bg-cyan-600" },
];

// 小分类预设（新增货物时可选，也可以自己输入）
export const SUBCATEGORIES = {
  kitchen: ["干粮", "米", "酒", "罐头", "面", "粉", "酱"],
  food: ["鱼", "猪肉", "鸡肉", "冷冻食品"],
};

export function fmtMoney(n) {
  return `RM ${(Number(n) || 0).toFixed(2)}`;
}

// 本地日期 YYYY-MM-DD（马来西亚时间，不是 UTC）
export function today() {
  const t = new Date();
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}-${String(t.getDate()).padStart(2, "0")}`;
}

// 避免 0.1 + 0.2 这种小数误差
export function round(n) {
  return Math.round((Number(n) || 0) * 1000) / 1000;
}

function toItem(d) {
  const x = d.data();
  return {
    id: d.id,
    categoryId: x.categoryId ?? "",
    sub: x.sub ?? "",
    name: x.name ?? "",
    unit: x.unit ?? "个",
    price: Number(x.price) || 0,
    opening: Number(x.opening) || 0,
  };
}

function toMovement(d) {
  const x = d.data();
  return {
    id: d.id,
    itemId: x.itemId ?? "",
    type: x.type === "out" ? "out" : "in",
    qty: Number(x.qty) || 0,
    price: Number(x.price) || 0,
    date: x.date ?? "",
    note: x.note ?? "",
  };
}

// 实时读取：别的员工一改，所有人画面马上更新
export function useInventory() {
  const [items, setItems] = useState([]);
  const [movements, setMovements] = useState([]);
  const [loaded, setLoaded] = useState({ items: false, movements: false });
  const [error, setError] = useState("");

  useEffect(() => {
    const onErr = (e) => setError(e?.message || String(e));
    const u1 = onSnapshot(
      collection(db, "items"),
      (s) => {
        setItems(s.docs.map(toItem));
        setLoaded((l) => ({ ...l, items: true }));
      },
      onErr
    );
    const u2 = onSnapshot(
      collection(db, "movements"),
      (s) => {
        setMovements(s.docs.map(toMovement));
        setLoaded((l) => ({ ...l, movements: true }));
      },
      onErr
    );
    return () => {
      u1();
      u2();
    };
  }, []);

  return { items, movements, loaded: loaded.items && loaded.movements, error };
}

/* ---------- 写入（每次写入都同时记一笔修改记录） ---------- */

function strip(obj) {
  if (!obj) return null;
  const { id, ...rest } = obj; // eslint-disable-line no-unused-vars
  return rest;
}

function addAudit(b, me, { table, recordId, action, oldData, newData }) {
  b.set(doc(collection(db, "audit_log")), {
    table,
    recordId,
    action,
    oldData: strip(oldData),
    newData: strip(newData),
    userId: me.uid,
    userName: me.name,
    createdAt: serverTimestamp(),
  });
}

function itemFields(i) {
  return {
    categoryId: i.categoryId,
    sub: i.sub || "",
    name: i.name,
    unit: i.unit || "个",
    price: Number(i.price) || 0,
    opening: Number(i.opening) || 0,
  };
}

function movementFields(m) {
  return {
    itemId: m.itemId,
    type: m.type,
    qty: Number(m.qty) || 0,
    price: Number(m.price) || 0,
    date: m.date,
    note: m.note || "",
  };
}

export async function addItem(me, item) {
  const ref = doc(collection(db, "items"));
  const data = itemFields(item);
  const b = writeBatch(db);
  b.set(ref, { ...data, createdAt: serverTimestamp(), createdBy: me.uid });
  addAudit(b, me, { table: "items", recordId: ref.id, action: "INSERT", newData: data });
  await b.commit();
}

export async function updateItem(me, oldItem, newItem) {
  const data = itemFields(newItem);
  const b = writeBatch(db);
  b.update(doc(db, "items", oldItem.id), { ...data, updatedAt: serverTimestamp(), updatedBy: me.uid });
  addAudit(b, me, {
    table: "items",
    recordId: oldItem.id,
    action: "UPDATE",
    oldData: itemFields(oldItem),
    newData: data,
  });
  await b.commit();
}

// 删除货物 + 它的进出货记录（一次最多 400 笔，分批）
export async function deleteItem(me, item, movements) {
  const related = movements.filter((m) => m.itemId === item.id);
  const b = writeBatch(db);
  b.delete(doc(db, "items", item.id));
  addAudit(b, me, { table: "items", recordId: item.id, action: "DELETE", oldData: itemFields(item) });
  await b.commit();
  for (let i = 0; i < related.length; i += 400) {
    const chunk = related.slice(i, i + 400);
    const b2 = writeBatch(db);
    chunk.forEach((m) => b2.delete(doc(db, "movements", m.id)));
    await b2.commit();
  }
}

export async function addMovement(me, m, itemName) {
  const ref = doc(collection(db, "movements"));
  const data = movementFields(m);
  const b = writeBatch(db);
  b.set(ref, { ...data, createdAt: serverTimestamp(), createdBy: me.uid });
  addAudit(b, me, {
    table: "movements",
    recordId: ref.id,
    action: "INSERT",
    newData: { ...data, itemName },
  });
  await b.commit();
}

export async function updateMovement(me, oldM, newM, itemName) {
  const data = movementFields(newM);
  const b = writeBatch(db);
  b.update(doc(db, "movements", oldM.id), { ...data, updatedAt: serverTimestamp(), updatedBy: me.uid });
  addAudit(b, me, {
    table: "movements",
    recordId: oldM.id,
    action: "UPDATE",
    oldData: { ...movementFields(oldM), itemName },
    newData: { ...data, itemName },
  });
  await b.commit();
}

export async function deleteMovement(me, m, itemName) {
  const b = writeBatch(db);
  b.delete(doc(db, "movements", m.id));
  addAudit(b, me, {
    table: "movements",
    recordId: m.id,
    action: "DELETE",
    oldData: { ...movementFields(m), itemName },
  });
  await b.commit();
}
