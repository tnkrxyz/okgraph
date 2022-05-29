import type { NextApiRequest, NextApiResponse } from 'next'
import axios from 'axios'
import { isValidID, isValidName } from '..'

interface Block {
  hash: string
  number: string
}

interface SubgraphError {
  message: string
  block?: Block
  handler?: string
  deterministic: boolean
}

interface ChainIndexingStatus {
  network: string
  chainHeadBlock?: Block
  earliestBlock?: Block
  latestBlock?: Block
  lastHealthyBlock?: Block
}

export interface SubgraphIndexingStatus {
  subgraph: string
  synced: boolean
  health: 'healthy' | 'unhealthy' | 'failed'
  fatalError?: SubgraphError
  // it may or may not be in the response body
  nonFatalErrors?: SubgraphError[]
  chains: ChainIndexingStatus[]
  entityCount: string
  node?: string
}

type Result<T> =
  | {
      data: T
      error?: never
    }
  | {
      data?: never
      error: { message: string }
    }

// Uncomment below to debug
// axios.interceptors.request.use((request) => {
//   console.log('Starting Request', JSON.stringify(request, null, 2))
//   return request
// })

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<Result<SubgraphIndexingStatus>>
) {
  const subgraphID = req.query['subgraphID'] as string
  try {
    const data = await fetchStatus(subgraphID)
    res.status(200).send({
      data,
    })
  } catch (error: any) {
    console.log(JSON.stringify(error, Object.getOwnPropertyNames(error)))
    return {
      error: {
        message: 'unknown error',
      },
    }
  }
}

async function fetchStatus(
  subgraphID: string
): Promise<SubgraphIndexingStatus> {
  let queryName = ''
  let queryParams = ''
  if (isValidID(subgraphID)) {
    queryName = 'indexingStatuses'
    queryParams = `(subgraphs: ["${subgraphID}"])`
  } else if (isValidName(subgraphID)) {
    queryName = 'indexingStatusesForSubgraphName'
    queryParams = `(subgraphName: "${subgraphID}")`
  }
  const query = `{
        ${queryName}${queryParams}{
          subgraph
          synced
          health
          entityCount
          fatalError {
            handler
            message
            deterministic
            block {
              hash
              number
            }
          }
          chains {
            network
            chainHeadBlock {
              number
              hash
            }
            earliestBlock {
              number
              hash
            }
            latestBlock {
              number
              hash
            }
            lastHealthyBlock {
              hash
              number
            }
          }
          node
        }
      }`
  const resp = await axios.post(
    'https://api.thegraph.com/index-node/graphql',
    JSON.stringify({ query })
  )
  return resp.data.data[queryName][0] as SubgraphIndexingStatus
}
