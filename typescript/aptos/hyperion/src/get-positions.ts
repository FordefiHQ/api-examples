import { sdk, fordefiConfig } from "./config"

async function fetchPositionsByAddress() {
    const positions = await sdk.Position.fetchAllPositionsByAddress({
        address: fordefiConfig.originAddress
    })
    console.log(positions)
}

if (require.main === module) {
  fetchPositionsByAddress();
}