// SNAPSHOT GOVERNANCE CLIENT — public GraphQL, no API key.

const SNAPSHOT_GRAPHQL_URL = "https://hub.snapshot.org/graphql";

export interface SnapshotProposal {
  id: string;
  title: string;
  body: string;
  state: "active" | "closed" | "pending" | string;
  end: number;
  scores?: (number | string)[] | null;
  quorum?: number | null;
  link?: string | null;
  space: { id: string; name: string };
}

export async function fetchSnapshotProposals(
  spaceId: string,
  limit: number = 10,
): Promise<SnapshotProposal[]> {
  const query = `
    query Proposals($space: String!, $first: Int!) {
      proposals(
        first: $first
        skip: 0
        where: { space_in: [$space] }
        orderBy: "created"
        orderDirection: desc
      ) {
        id
        title
        body
        state
        end
        scores
        quorum
        link
        space { id name }
      }
    }
  `;

  const res = await fetch(SNAPSHOT_GRAPHQL_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query, variables: { space: spaceId, first: limit } }),
  });

  if (!res.ok) {
    throw new Error(`Snapshot API error: ${res.status}`);
  }

  const data = (await res.json()) as {
    data?: { proposals?: SnapshotProposal[] };
    errors?: Array<{ message: string }>;
  };

  if (data.errors?.length) {
    throw new Error(`Snapshot GraphQL error: ${data.errors[0]!.message}`);
  }

  return data.data?.proposals ?? [];
}

export const KNOWN_SNAPSHOT_SPACES: Record<string, string> = {
  UNI: "uniswap",
  AAVE: "aave.eth",
  COMP: "comp-vote.eth",
  ENS: "ens.eth",
  CRV: "curve.eth",
  MKR: "makerdao.eth",
  BAL: "balancer.eth",
  SUSHI: "sushi",
  YFI: "ybaby.eth",
  GTC: "gitcoindao.eth",
  RPL: "rocketpool-dao.eth",
  LDO: "lido-snapshot.eth",
};
