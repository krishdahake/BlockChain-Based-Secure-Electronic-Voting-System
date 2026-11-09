export const fmtDate = (d) => (d ? new Date(d).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }) : "-");
export const toLocalInput = (d) => {
  const x = new Date(d); x.setMinutes(x.getMinutes() - x.getTimezoneOffset());
  return x.toISOString().slice(0, 16);
};
export const palette = ["#7c3aed", "#243469", "#a78bfa", "#3d56a3", "#c4b5fd", "#5f78c0", "#6d28d9", "#8fa1d8"];
