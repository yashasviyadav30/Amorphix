import type { ToolStub } from "eve/evals";

// Synthetic tool results: evals never write to the real database or spend model quota.
export const quietTools: ToolStub[] = [
  { id: "set-project", tool: "set_project", outcome: { response: { saved: true } } },
  { id: "save-answers", tool: "save_answers", outcome: { response: { saved: ["noted"] } } },
  { id: "finish", tool: "finish_interview", outcome: { response: { ready: false, stillNeed: ["at least 3 things they love: places, brands, films or music"] } } },
];

export const aceHotelTaste: ToolStub[] = [
  {
    id: "add-ace",
    tool: "add_taste",
    outcome: {
      response: {
        tasteCount: 1,
        added: [{ name: "Ace Hotel New York", kind: "place", look: "vintage post-industrial lobby, moody dark wood, worn leather and warm low light" }],
      },
    },
  },
];
