export interface DesignTokens {
  colors?: Record<string, string>;
  spacing?: Record<string, string>;
  typography?: Record<string, string>;
  borderRadius?: Record<string, string>;
}

export function applyTokens(tokens: DesignTokens): void {
  if (typeof document === "undefined") return;

  const root = document.documentElement;

  const sections: [keyof DesignTokens, string][] = [
    ["colors", "--color"],
    ["spacing", "--spacing"],
    ["typography", "--font"],
    ["borderRadius", "--radius"],
  ];

  for (const [section, prefix] of sections) {
    const values = tokens[section];
    if (!values) continue;
    for (const [key, value] of Object.entries(values)) {
      root.style.setProperty(`${prefix}-${key}`, value);
    }
  }
}

export function loadTokensFromJSON(json: string): DesignTokens {
  return JSON.parse(json) as DesignTokens;
}
