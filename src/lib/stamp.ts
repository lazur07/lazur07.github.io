export const stamp = (d: Date) => d.toISOString().slice(0, 10).replaceAll("-", ".");
