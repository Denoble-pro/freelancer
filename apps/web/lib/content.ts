import { contentDefaultMap, interpolate } from "@dlp/shared";

export type Translator = (key: string, variables?: Record<string, string | number>) => string;

export function makeT(content: Record<string, string>): Translator {
  return (key, variables) => {
    const template = content[key] ?? contentDefaultMap[key] ?? key;
    return interpolate(template, variables);
  };
}
