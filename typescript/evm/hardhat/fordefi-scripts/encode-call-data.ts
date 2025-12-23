import { ethers } from 'ethers';

export function encodeCallData(
  abi: ethers.InterfaceAbi,
  functionName: string,
  args: unknown[] = []
): string {
  const iface = new ethers.Interface(abi);
  return iface.encodeFunctionData(functionName, args);
}