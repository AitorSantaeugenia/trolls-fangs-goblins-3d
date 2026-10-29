// MongoDB simulado en memoria (solo para las pruebas): implementa lo que usan lib/store-mongo.mjs y admin-app/src/db.js
const get = (d, k) => d[k];
function match(doc, q) {
  for (const [k, v] of Object.entries(q)) {
    if (k === '$or') { if (!v.some((sub) => match(doc, sub))) return false; continue; }
    const x = get(doc, k);
    if (v && typeof v === 'object' && !(v instanceof Date) && Object.keys(v).some((o) => o.startsWith('$'))) {
      for (const [op, val] of Object.entries(v)) {
        const a = x instanceof Date ? x.getTime() : x, b = val instanceof Date ? val.getTime() : val;
        if (op === '$ne' && a === b) return false;
        if (op === '$gt' && !(a > b)) return false;
        if (op === '$lt' && !(a < b)) return false;
        if (op === '$gte' && !(a >= b)) return false;
        if (op === '$in' && !val.includes(x)) return false;
      }
    } else if (x !== v) return false;
  }
  return true;
}
const clone = (d) => structuredClone(d);
class Cursor {
  constructor(docs) { this.docs = docs; }
  sort(spec) { const ks = Object.entries(spec); this.docs.sort((a, b) => { for (const [k, dir] of ks) { if (a[k] < b[k]) return -dir; if (a[k] > b[k]) return dir; } return 0; }); return this; }
  limit(n) { this.docs = this.docs.slice(0, n); return this; }
  async toArray() { return this.docs.map(clone); }
}
class Coll {
  constructor() { this.docs = []; this.n = 0; }
  async createIndex() { return 'ok'; }
  async findOne(q) { const d = this.docs.find((x) => match(x, q)); return d ? clone(d) : null; }
  find(q = {}) { return new Cursor(this.docs.filter((x) => match(x, q))); }
  async countDocuments(q = {}) { return this.docs.filter((x) => match(x, q)).length; }
  async insertOne(d) { this.docs.push({ _id: d._id ?? ++this.n, ...clone(d) }); }
  async insertMany(list) { for (const d of list) await this.insertOne(d); }
  async updateOne(f, u, o = {}) {
    const d = this.docs.find((x) => match(x, f));
    const inc = (doc) => { for (const [k, n] of Object.entries(u.$inc || {})) doc[k] = (doc[k] || 0) + n; };
    if (!d && o.upsert) { const nd = { _id: ++this.n, ...f, ...(u.$setOnInsert || {}), ...(u.$set || {}) }; inc(nd); this.docs.push(nd); }
    else if (d) { Object.assign(d, u.$set || {}); inc(d); }
  }
  async replaceOne(f, doc) { const i = this.docs.findIndex((x) => match(x, f)); if (i >= 0) this.docs[i] = { _id: this.docs[i]._id, ...clone(doc) }; }
  async deleteOne(f) { const i = this.docs.findIndex((x) => match(x, f)); if (i >= 0) this.docs.splice(i, 1); }
  async updateMany(f, u) {
    let n = 0;
    for (const d of this.docs) if (match(d, f)) { Object.assign(d, clone(u.$set || {})); for (const k of Object.keys(u.$unset || {})) delete d[k]; n++; }
    return { matchedCount: n, modifiedCount: n };
  }
  async deleteMany(f) { const before = this.docs.length; this.docs = this.docs.filter((x) => !match(x, f)); return { deletedCount: before - this.docs.length }; }
}
export function fakeDb() { const cs = {}; return { collection: (n) => (cs[n] ||= new Coll()), _cs: cs }; }
