export type MailLayout = Record<string, number>;

export const mailPanelIds = {
  sidebar: "mail-sidebar",
  list: "mail-list",
  detail: "mail-detail",
} as const;

export const defaultMailLayout = createMailLayout({
  [mailPanelIds.sidebar]: 20,
  [mailPanelIds.list]: 32,
  [mailPanelIds.detail]: 48,
});

export function createMailLayout(layout: MailLayout): MailLayout {
  return {
    [mailPanelIds.sidebar]: layout[mailPanelIds.sidebar],
    [mailPanelIds.list]: layout[mailPanelIds.list],
    [mailPanelIds.detail]: layout[mailPanelIds.detail],
  };
}
