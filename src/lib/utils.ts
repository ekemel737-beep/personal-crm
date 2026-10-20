import { createCn } from "cn/config";

// Class merging that knows the custom tokens from src/app/tokens.css.
// Without this it reads `text-label` as a color and `border-strong` as a border
// color, and silently drops them next to `text-ink` or `border-ink`.
export const cn = createCn({
  extend: {
    theme: {
      text: ["logo", "label", "title", "name", "body", "meta", "field", "button", "button-lg"],
    },
    classGroups: {
      "border-w": [{ border: ["strong"] }],
      "border-w-x": [{ "border-x": ["strong"] }],
      "border-w-y": [{ "border-y": ["strong"] }],
      "border-w-t": [{ "border-t": ["strong"] }],
      "border-w-r": [{ "border-r": ["strong"] }],
      "border-w-b": [{ "border-b": ["strong"] }],
      "border-w-l": [{ "border-l": ["strong"] }],
    },
  },
});
