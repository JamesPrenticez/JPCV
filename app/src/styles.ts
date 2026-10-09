import styled, { createGlobalStyle } from "styled-components";

export const GlobalStyle = createGlobalStyle`
  :root {
    color-scheme: light dark;
    --bg: #f5f6f8; --card: #fff; --text: #1c2330; --muted: #667085; --line: #e3e6ec;
    --accent: #2f7c47; --on-accent: #fff; --danger: #c0392b;
  }
  @media (prefers-color-scheme: dark) {
    :root { --bg: #14171c; --card: #1d2128; --text: #e7e9ee; --muted: #9aa3b2; --line: #2c323c; --accent: #4cad69; --on-accent: #0b1a10; --danger: #e5675a; }
  }
  * { box-sizing: border-box; }
  body { margin: 0; background: var(--bg); color: var(--text); font: 14px/1.4 system-ui, sans-serif; }
  a { color: var(--accent); }
  input, select, textarea { font: inherit; color: inherit; background: var(--card); border: 1px solid var(--line); border-radius: 6px; padding: 6px 8px; }
  :focus-visible { outline: 2px solid var(--accent); outline-offset: 1px; }
`;

export const Button = styled.button<{ $primary?: boolean; $danger?: boolean }>`
  font: inherit;
  cursor: pointer;
  padding: 6px 14px;
  border-radius: 6px;
  border: 1px solid ${(p) => (p.$primary ? "var(--accent)" : p.$danger ? "var(--danger)" : "var(--line)")};
  background: ${(p) => (p.$primary ? "var(--accent)" : "var(--card)")};
  color: ${(p) => (p.$primary ? "var(--on-accent)" : p.$danger ? "var(--danger)" : "var(--text)")};
`;
