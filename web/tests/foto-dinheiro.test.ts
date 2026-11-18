import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("node:fs", () => ({ existsSync: vi.fn() }));
import { existsSync } from "node:fs";
import { fotoDoDinheiro } from "../src/lib/foto-dinheiro";

afterEach(() => vi.resetAllMocks());

describe("fotos da seção Dinheiro", () => {
  it("usa o arquivo da candidatura disponível, mesmo sem id da pessoa ou banco de fotos", () => {
    vi.mocked(existsSync).mockReturnValue(true);
    expect(fotoDoDinheiro({ id_candidatura: 42, id_candidato: null })).toBe("/fotos-candidatos/42.jpg");
  });
  it("sem arquivo local tenta o retrato da pessoa na API", () => {
    vi.mocked(existsSync).mockReturnValue(false);
    expect(fotoDoDinheiro({ id_candidatura: 42, id_candidato: 7 })).toBe("/api/candidatos/7/foto?tam=mini");
    expect(fotoDoDinheiro({ id_candidatura: 42, id_candidato: null })).toBeNull();
  });
});
