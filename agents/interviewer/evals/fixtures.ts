import type { ToolStub } from "eve/evals";

// Synthetic tool results: evals never write to the real database or spend Qloo quota.
export const quietTools: ToolStub[] = [
  { id: "set-project", tool: "set_project", outcome: { response: { saved: true } } },
  { id: "save-answers", tool: "save_answers", outcome: { response: { saved: ["noted"] } } },
  { id: "finish", tool: "finish_interview", outcome: { response: { ready: false, stillNeed: ["at least 3 things they love: places, brands, films or music"] } } },
];

export const aceHotelTaste: ToolStub[] = [
  {
    id: "find-ace",
    tool: "find_taste",
    outcome: {
      response: { results: [{ asked: "Ace Hotel New York", matches: [{ entityId: "ent-ace", name: "Ace Hotel New York", kind: "place", detail: "20 W 29th St, New York", layer: 1 }] }] },
    },
  },
  {
    id: "add-ace",
    tool: "add_taste",
    match: { entityIds: { contains: { const: "ent-ace" } } },
    outcome: {
      response: {
        tasteCount: 1,
        style: [
          { word: "vintage", from: ["Ace Hotel New York"] },
          { word: "moodily dark", from: ["Ace Hotel New York"] },
          { word: "post industrial", from: ["Ace Hotel New York"] },
        ],
        brands: [],
      },
    },
  },
];
