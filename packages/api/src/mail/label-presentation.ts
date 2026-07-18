export type LabelLike = { readonly id: string; readonly name: string; readonly type: string };

function getDisplayLabel(label: LabelLike) {
  if (label.id === "IMPORTANT") {
    return ["important"];
  }

  if (label.id === "STARRED") {
    return ["starred"];
  }

  if (label.type === "user") {
    return [label.name.toLowerCase()];
  }

  return [];
}

export function getDisplayLabels(labels: readonly LabelLike[]) {
  return labels
    .flatMap((label) => getDisplayLabel(label))
    .filter((label, index, allLabels) => allLabels.indexOf(label) === index)
    .slice(0, 3);
}

export function formatMailBadgeCount(count: number, options?: { readonly cap?: number }) {
  if (count <= 0) {
    return null;
  }

  if (options?.cap !== undefined && count > options.cap) {
    return `${options.cap}+`;
  }

  return String(count);
}
