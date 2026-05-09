function part(len: number): string {
  let out = "";
  while (out.length < len) out += Math.floor(Math.random() * 0xffffffff).toString(16);
  return out.slice(0, len);
}

/** UUID v4-like ID for app-local object keys (non-cryptographic). */
export function randomUUIDCompat(): string {
  const p1 = part(8);
  const p2 = part(4);
  const p3 = `4${part(3)}`;
  const variant = ((8 + Math.floor(Math.random() * 4)).toString(16) + part(3)).slice(0, 4);
  const p5 = part(12);
  return `${p1}-${p2}-${p3}-${variant}-${p5}`;
}
