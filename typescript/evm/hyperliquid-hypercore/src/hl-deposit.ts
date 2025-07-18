import { error } from 'console';
import { HyperliquidConfig, fordefiConfig } from './config'
import { getProvider } from './get-provider';
import { ethers, parseUnits, formatUnits } from 'ethers';

interface PermitPayload {
    owner: string;
    spender: string;
    value: string;
    nonce: string;
    deadline: string;
};

// Function to split signature into r, s, v components
function splitSignatures(signature: string): { r: string; s: string; v: number } {
    const r = signature.slice(0, 66);
    const s = "0x" + signature.slice(66, 130);
    const v = parseInt(signature.slice(130, 132), 16);
    return { r, s, v };
};

export async function deposit(hyperliquidConfig: HyperliquidConfig) {
    let provider = await getProvider(fordefiConfig);
    if (!provider) {
      throw new Error("Failed to initialize provider");
    }
    let web3Provider = new ethers.BrowserProvider(provider); 
    const signer = await web3Provider.getSigner();
    
    // Get the USDC contract to fetch the nonce
    const usdcAddress = "0xaf88d065e77c8cC2239327C5EDb3A432268e5831"; // Arbitrum USDC
    const usdcAbi = ["function nonces(address owner) view returns (uint256)"]; // Minimal ABI for nonces
    const usdcContract = new ethers.Contract(usdcAddress, usdcAbi, signer);

    const fordefiVault = fordefiConfig.address;
    const hyperliquidBridgeAddress = "0x2df1c51e09aecf9cacb7bc98cb1742757f163df7"; // Mainnet bridge contract
    
    // Get the current nonce for the vault address
    const nonce = await (usdcContract as any).nonces(fordefiVault);
    
    // Validate the amount is at least 5 USDC
    const minAmount = 5; // Minimum 5 USDC required
    const amount = hyperliquidConfig?.amount 
        ? parseFloat(hyperliquidConfig.amount)
        : 5; // Default to 5 USDC if not specified

    if (amount < minAmount) {
        throw new Error(`Deposit amount must be at least ${minAmount} USDC. Received: ${amount} USDC`);
    }

    // Convert amount to smallest units (for example -> 1 USDC = 1000000)
    const value = parseUnits(amount.toString(), 6).toString();
    
    const deadline = Math.floor(Date.now() / 1000 + 3600).toString(); // 1 hour from now
    
    const payload: PermitPayload = {
        owner: fordefiVault, // The address of the user with funds they want to deposit
        spender: hyperliquidBridgeAddress, // The address of the bridge 
        value,
        nonce,
        deadline
    };
    
    let isMainnet
    if (hyperliquidConfig.isTestnet){
        isMainnet = false
    } else{
        isMainnet = true
    }

    const domain = {
        name: isMainnet ? "USD Coin" : "USDC2",
        version: isMainnet ? "2" : "1",
        chainId: isMainnet ? 42161 : 421614,
        verifyingContract: isMainnet ? "0xaf88d065e77c8cC2239327C5EDb3A432268e5831" : "0x1baAbB04529D43a73232B713C0FE471f7c7334d5",
    };
    
    const permitTypes = {
        Permit: [
            { name: "owner", type: "address" },
            { name: "spender", type: "address" },
            { name: "value", type: "uint256" },
            { name: "nonce", type: "uint256" },
            { name: "deadline", type: "uint256" },
        ],
    };
    
    const dataToSign = {
        domain,
        types: permitTypes,
        primaryType: "Permit",
        message: payload,
    } as const;
    
    // Sign message
    const signature = await signer.signTypedData(
        dataToSign.domain,
        { Permit: dataToSign.types.Permit },
        dataToSign.message
    );
    
    // Fetch signature
    console.log('Signature:', signature);
    const splitSignature = splitSignatures(signature);
    console.log('Split signature:', splitSignature);

    // Instanciate Hyperliquid's Bridge ABI
    const bridgeAbi = [
        "function batchedDepositWithPermit(tuple(address user, uint64 usd, uint64 deadline, tuple(uint256 r, uint256 s, uint8 v) signature)[] deposits) external"
    ];
    
    // Create bridge contract instance
    const bridgeContract = await new ethers.Contract(
        hyperliquidBridgeAddress,
        bridgeAbi,
        signer
    );
    
    // Format signature for the contract call
    const signatureStruct = {
        r: splitSignature.r,
        s: splitSignature.s,
        v: splitSignature.v
    };
    
    // Create the deposit struct as expected by the contract
    const depositStruct = [{
        user: fordefiVault,
        usd: value,
        deadline,
        signature: signatureStruct
    }];
    
    console.log(`Depositing ${formatUnits(value, 6)} USDC to Hyperliquid bridge...`);
    
    // Call batchedDepositWithPermit function with the deposit struct
    const tx = await (bridgeContract as any).batchedDepositWithPermit(depositStruct);
    
    console.log(`Transaction submitted: ${tx.hash}`);
    console.log("Waiting for confirmation...");
    
    // Wait for the transaction to be mined
    const receipt = await tx.wait();
    console.log(`Transaction confirmed! Block number: ${receipt.blockNumber}`);
    
    return {
        transactionHash: tx.hash,
        blockNumber: receipt.blockNumber,
        amount: formatUnits(value, 6),
        user: fordefiVault
    };
};