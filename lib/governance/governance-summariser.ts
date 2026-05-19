import { generateGovernanceProposalSummary } from "@/lib/services/ai";
import { AI_DISCLAIMER } from "@/lib/constants/ai-models";

export async function summariseProposal(
  title: string,
  bodyPreview: string,
  tokenTicker: string,
  userId?: string,
): Promise<string> {
  const prompt =
    `
You are summarising a DeFi governance proposal for a portfolio investor.
The investor holds ${tokenTicker} in their portfolio and wants to know
if this proposal affects the protocol, the token value, or their position.

Proposal title: ${title}

Proposal text (first 1000 characters):
${bodyPreview.slice(0, 1000)}

Write a 2-3 sentence plain-English summary. Cover:
1. What the proposal asks to change
2. The likely impact on the protocol or token holders
3. Whether this is routine governance or a significant change

Do not use jargon. Do not repeat the title. Be direct and specific.
This is for informational purposes only — not financial advice.
  `.trim();

  try {
    return `${(await generateGovernanceProposalSummary(prompt, userId)).trim()}\n\n${AI_DISCLAIMER}`;
  } catch {
    return `Governance proposal: ${title}. Please review the full proposal at the source link for details.`;
  }
}
