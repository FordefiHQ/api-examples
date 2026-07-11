import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { Wallet } from "ethers";
import type { EvmAddress } from "./interfaces";

export function generateAgentKeypair(agentName: string, outputPath: string): EvmAddress {
    const wallet = Wallet.createRandom();
    mkdirSync(dirname(outputPath), { recursive: true, mode: 0o700 });
    writeFileSync(
        outputPath,
        JSON.stringify({ [`private_key_${agentName}`]: wallet.privateKey }, null, 2),
        { encoding: "utf8", flag: "wx", mode: 0o600 },
    );
    return wallet.address as EvmAddress;
}

export function buildAgentName(agentName: string, validUntil?: string): string {
    if (!agentName.trim()) throw new Error("agentName is required");
    return validUntil ? `${agentName} valid_until ${validUntil}` : agentName;
}
