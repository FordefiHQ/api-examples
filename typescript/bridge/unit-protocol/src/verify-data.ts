import { Proposal, VerificationResult } from './interfaces'
import { GUARDIANS, GUARDIAN_SIGNATURES} from './config'

function hexToBytes(hex: string): Uint8Array {
  const cleanHex = hex.startsWith('0x') ? hex.slice(2) : hex;
  return new Uint8Array(Buffer.from(cleanHex, 'hex'));
}

function legacyProposalToPayload(nodeId: string, proposal: Proposal): Uint8Array {
  const payloadString = `${nodeId}:${[
    proposal.destinationAddress,
    proposal.destinationChain,
    proposal.asset,
    proposal.address,
    proposal.sourceChain,
    'deposit'
  ].join('-')}`;
  return new TextEncoder().encode(payloadString);
}

function newProposalToPayload(nodeId: string, proposal: Proposal): Uint8Array {
  const payloadString = `${nodeId}:${[
    'user',
    proposal.coinType,
    proposal.destinationChain,
    proposal.destinationAddress,
    proposal.address
  ].join('-')}`;
  return new TextEncoder().encode(payloadString);
}

function proposalToPayload(nodeId: string, proposal: Proposal): Uint8Array {
  if (proposal.coinType === 'ethereum') {
    return newProposalToPayload(nodeId, proposal);
  }
  
  return legacyProposalToPayload(nodeId, proposal);
}

async function processGuardianNodes(nodes: { nodeId: string; publicKey: string }[]) {
  const processed = [];
  for (const node of nodes) {
    try {
      const publicKeyBytes = hexToBytes(node.publicKey);
      if (publicKeyBytes.length !== 65 || publicKeyBytes[0] !== 0x04) {
        throw new Error(`Invalid public key format for node ${node.nodeId}`);
      }
      const publicKey = await crypto.subtle.importKey(
        'raw',
        publicKeyBytes,
        { name: 'ECDSA', namedCurve: 'P-256' },
        true,
        ['verify']
      );
      processed.push({ nodeId: node.nodeId, publicKey });
    } catch (error) {
      console.error(`Failed to process node ${node.nodeId}:`, error);
      throw new Error(`Node processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
  return processed;
}

export async function verifySignature(publicKey: CryptoKey, message: Uint8Array, signature: string): Promise<boolean> {
  try {
    const sigBytes = Uint8Array.from(atob(signature), c => c.charCodeAt(0));
    if (sigBytes.length !== 64) {
      console.warn('Invalid signature length:', sigBytes.length);
      return false;
    }
    return await crypto.subtle.verify(
      {
        name: 'ECDSA',
        hash: { name: 'SHA-256' },
      },
      publicKey,
      sigBytes,
      message
    );
  } catch (error) {
    console.error('Signature verification failed:', error);
    return false;
  }
}

export async function verifyDepositAddressSignatures(
  signatures: { [nodeId: string]: string },
  proposal: Proposal
): Promise<VerificationResult> {
  try {
    const processedNodes = await processGuardianNodes(GUARDIANS);
    let verifiedCount = 0;
    const errors: string[] = [];
    const verificationDetails: { [nodeId: string]: boolean } = {};

    await Promise.all(
      processedNodes.map(async (node) => {
        try {
          if (!signatures[node.nodeId]) {
            verificationDetails[node.nodeId] = false;
            return;
          }        
          let isVerified = false;
          
          if (proposal.coinType !== 'ethereum') {
            const legacyPayload = legacyProposalToPayload(node.nodeId, proposal);
            isVerified = await verifySignature(node.publicKey, legacyPayload, signatures[node.nodeId]!);
            
            if (!isVerified) {
              const newPayload = newProposalToPayload(node.nodeId, proposal);
              isVerified = await verifySignature(node.publicKey, newPayload, signatures[node.nodeId]!);
            }
          } else {
            const payload = newProposalToPayload(node.nodeId, proposal);
            isVerified = await verifySignature(node.publicKey, payload, signatures[node.nodeId]!);
          }
          
          verificationDetails[node.nodeId] = isVerified;
          if (isVerified) verifiedCount++;
        } catch (error) {
          errors.push(`Verification failed for node ${node.nodeId}: ${error instanceof Error ? error.message : 'Unknown error'}`);
          verificationDetails[node.nodeId] = false;
        }
      })
    );

    return {
      success: verifiedCount >= GUARDIAN_SIGNATURES,
      verifiedCount,
      errors: errors.length > 0 ? errors : undefined,
      verificationDetails
    };
  } catch (error) {
    return {
      success: false,
      verifiedCount: 0,
      errors: [`Global verification error: ${error instanceof Error ? error.message : 'Unknown error'}`],
      verificationDetails: {}
    };
  }
}