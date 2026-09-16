import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { DifficultyTag } from "./DifficultyTag";

describe("DifficultyTag", () => {
  it.each(["facil", "media", "dificil"])("renderiza o rótulo da dificuldade %s", (dificuldade) => {
    render(<DifficultyTag dificuldade={dificuldade} />);
    expect(screen.getByText(dificuldade)).toBeInTheDocument();
  });
});
