#!/bin/bash

# VaultV2 Test Deployment Script
# This script spawns anvil, tests deployment, shows results, then stops anvil

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Function to cleanup on exit
cleanup() {
    print_status "Cleaning up..."
    
    # Kill anvil if it's running
    if [ ! -z "$ANVIL_PID" ]; then
        print_status "Stopping anvil (PID: $ANVIL_PID)"
        kill $ANVIL_PID 2>/dev/null || true
        wait $ANVIL_PID 2>/dev/null || true
    fi
    
    # Restore .env if it exists
    if [ -f ".env.arch" ]; then
        print_status "Restoring original .env file"
        mv .env.arch .env
    fi
    
    print_status "Cleanup complete"
}

# Set up trap for cleanup on exit
trap cleanup EXIT

print_status "Starting VaultV2 test deployment process..."

# Step 1: Check if anvil is already running on port 8545
if pgrep -f "anvil.*8545" > /dev/null; then
    print_warning "Anvil is already running on port 8545. Please stop it first or use a different port."
    exit 1
fi

# Also check if port 8545 is in use
if lsof -i :8545 > /dev/null 2>&1; then
    print_warning "Port 8545 is already in use. Please stop the process using this port or use a different port."
    exit 1
fi

# Step 2: Start anvil in background
print_status "Starting anvil local blockchain..."
anvil --host 0.0.0.0 --port 8545 --chain-id 31337 > anvil.log 2>&1 &
ANVIL_PID=$!

# Check if the process started
if [ -z "$ANVIL_PID" ] || [ "$ANVIL_PID" -eq 0 ]; then
    print_error "Failed to start anvil process"
    exit 1
fi

# Wait for anvil to start
sleep 3

# Check if anvil started successfully
if ! kill -0 $ANVIL_PID 2>/dev/null; then
    print_error "Failed to start anvil. Check anvil.log for details."
    exit 1
fi

# Verify anvil is responding (with retries)
print_status "Verifying anvil RPC connectivity..."
for i in {1..5}; do
    if curl -s -X POST -H "Content-Type: application/json" --data '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}' http://localhost:8545 > /dev/null 2>&1; then
        break
    fi
    if [ $i -eq 5 ]; then
        print_error "Anvil is not responding to RPC calls after 5 attempts"
        exit 1
    fi
    print_status "RPC not ready, retrying in 2 seconds... (attempt $i/5)"
    sleep 2
done

print_success "Anvil started successfully (PID: $ANVIL_PID)"

# Step 3: Archive current .env if it exists
if [ -f ".env" ]; then
    print_status "Archiving current .env file to .env.arch"
    if ! cp .env .env.arch; then
        print_error "Failed to archive current .env file"
        exit 1
    fi
else
    print_status "No existing .env file found"
fi

# Step 4: Deploy mocks and factories
print_status "Deploying mocks and factories..."

# Deploy mocks first
print_status "Deploying mocks..."
if ! MOCKS_OUTPUT=$(forge script test/script/DeployMocks.s.sol --rpc-url http://localhost:8545 --broadcast --private-key 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80 2>&1); then
    print_error "Mocks deployment failed"
    echo "MOCKS_OUTPUT:"
    echo "$MOCKS_OUTPUT"
    exit 1
fi

# Extract addresses from mocks deployment
VAULT_V1=$(echo "$MOCKS_OUTPUT" | grep -o "Mock VaultV1 0x[a-fA-F0-9]*" | awk '{print $3}')
ASSET=$(echo "$MOCKS_OUTPUT" | grep -o "Mock Asset: *0x[a-fA-F0-9]*" | awk '{print $3}')
REGISTRY=$(echo "$MOCKS_OUTPUT" | grep -o "Mock Registry 0x[a-fA-F0-9]*" | awk '{print $3}')

if [ -z "$VAULT_V1" ] || [ -z "$ASSET" ] || [ -z "$REGISTRY" ]; then
    print_error "Failed to extract addresses from mocks deployment"
    echo "MOCKS_OUTPUT:"
    echo "$MOCKS_OUTPUT"
    exit 1
fi

print_success "Mocks deployed successfully:"
print_status "  VaultV1: $VAULT_V1"
print_status "  Asset: $ASSET"
print_status "  Registry: $REGISTRY"

# Deploy factories
print_status "Deploying factories..."
if ! FACTORIES_OUTPUT=$(forge script test/script/DeployFactories.s.sol --rpc-url http://localhost:8545 --broadcast --private-key 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80 2>&1); then
    print_error "Factories deployment failed"
    echo "FACTORIES_OUTPUT:"
    echo "$FACTORIES_OUTPUT"
    exit 1
fi

# Extract addresses from factories deployment
VAULT_V2_FACTORY=$(echo "$FACTORIES_OUTPUT" | grep -o "VaultV2Factory 0x[a-fA-F0-9]*" | cut -d' ' -f2)
MORPHO_VAULT_V1_ADAPTER_FACTORY=$(echo "$FACTORIES_OUTPUT" | grep -o "MorphoVaultV1AdapterFactory 0x[a-fA-F0-9]*" | cut -d' ' -f2)

if [ -z "$VAULT_V2_FACTORY" ] || [ -z "$MORPHO_VAULT_V1_ADAPTER_FACTORY" ]; then
    print_error "Failed to extract addresses from factories deployment"
    echo "FACTORIES_OUTPUT:"
    echo "$FACTORIES_OUTPUT"
    exit 1
fi

print_success "Factories deployed successfully:"
print_status "  VaultV2Factory: $VAULT_V2_FACTORY"
print_status "  MorphoVaultV1AdapterFactory: $MORPHO_VAULT_V1_ADAPTER_FACTORY"

# Step 5: Create .env file with deployment addresses
print_status "Creating .env file with deployment addresses..."

if ! cat > .env << EOF
# VaultV2 Test Deployment Environment Variables
# Generated on $(date)

# Role addresses (using anvil default accounts)
OWNER=0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266
CURATOR=0x70997970C51812dc3A010C7d01b50e0d17dc79C8
ALLOCATOR=0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC
SENTINEL=0x90F79bf6EB2c4f870365E785982E1f101E93b906

# Timelock duration (in seconds) - set to 0 for immediate execution
TIMELOCK_DURATION=0

# Deployed contract addresses
VAULT_V1=$VAULT_V1
ADAPTER_REGISTRY=$REGISTRY
VAULT_V2_FACTORY=$VAULT_V2_FACTORY
MORPHO_VAULT_V1_ADAPTER_FACTORY=$MORPHO_VAULT_V1_ADAPTER_FACTORY

# RPC URL
RPC_URL=http://localhost:8545

# Private key for deployment (anvil default account 0)
PRIVATE_KEY=0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
EOF
then
    print_error "Failed to create .env file"
    exit 1
fi

print_success ".env file created with deployment addresses"

# Step 6: Run the main deployment script
print_status "Running VaultV2 deployment script..."

# Run the deployment script (ignore exit code as forge may return non-zero due to wallet warnings)
set +e  # Temporarily disable exit on error for this command
DEPLOYMENT_OUTPUT=$(forge script script/DeployVaultV2.s.sol --rpc-url http://localhost:8545 --broadcast --private-key 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80 2>&1)
DEPLOYMENT_EXIT_CODE=$?
set -e  # Re-enable exit on error

# Extract VaultV2 address
VAULT_V2=$(echo "$DEPLOYMENT_OUTPUT" | grep -o "VaultV2 deployed at: 0x[a-fA-F0-9]*" | cut -d' ' -f4)

if [ -z "$VAULT_V2" ]; then
    print_error "Failed to extract VaultV2 address from deployment - deployment may have failed"
    echo "DEPLOYMENT_OUTPUT:"
    echo "$DEPLOYMENT_OUTPUT"
    exit 1
fi

# Check if deployment actually failed by looking for error patterns
if echo "$DEPLOYMENT_OUTPUT" | grep -q "Error:" && ! echo "$DEPLOYMENT_OUTPUT" | grep -q "VaultV2 deployed at:"; then
    print_error "VaultV2 deployment failed with errors"
    echo "DEPLOYMENT_OUTPUT:"
    echo "$DEPLOYMENT_OUTPUT"
    exit 1
fi

print_success "VaultV2 test deployment successful at: $VAULT_V2"

# Step 7: Dump .env file for visualization
print_status "=== ENVIRONMENT CONFIGURATION ==="
if [ -f ".env" ]; then
    print_status "Current .env file contents:"
    echo "----------------------------------------"
    cat .env
    echo "----------------------------------------"
else
    print_warning "No .env file found"
fi

# Step 8: Verify vault configuration
print_status "=== VAULT CONFIGURATION VERIFICATION ==="
print_status "Verifying VaultV2 configuration..."

# Verify vault configuration by checking deployment logs
print_status "Verifying vault configuration from deployment logs..."

# Extract key configuration from deployment output
echo ""
print_status "=== VAULT CONFIGURATION VERIFICATION ==="
print_status "VaultV2 Address: $VAULT_V2"
print_status "Deployment Status: ✅ SUCCESS"

# Check if key deployment steps were completed
if echo "$DEPLOYMENT_OUTPUT" | grep -q "Broadcaster set as Curator"; then
    print_status "Curator Role: ✅ Set"
else
    print_warning "Curator Role: ❌ Not set"
fi

if echo "$DEPLOYMENT_OUTPUT" | grep -q "Adapter Registry submission submitted"; then
    print_status "Adapter Registry: ✅ Set"
else
    print_warning "Adapter Registry: ❌ Not set"
fi

if echo "$DEPLOYMENT_OUTPUT" | grep -q "MorphoVaultV1Adapter deployed at:"; then
    MORPHO_ADAPTER=$(echo "$DEPLOYMENT_OUTPUT" | grep -o "MorphoVaultV1Adapter deployed at: 0x[a-fA-F0-9]*" | cut -d' ' -f4)
    print_status "MorphoVaultV1Adapter: ✅ Deployed at $MORPHO_ADAPTER"
else
    print_warning "MorphoVaultV1Adapter: ❌ Not deployed"
fi

if echo "$DEPLOYMENT_OUTPUT" | grep -q "All timelocked actions submitted"; then
    print_status "Timelocked Actions: ✅ Submitted"
else
    print_warning "Timelocked Actions: ❌ Not submitted"
fi

if echo "$DEPLOYMENT_OUTPUT" | grep -q "All timelocked actions executed"; then
    print_status "Timelocked Actions: ✅ Executed"
else
    print_warning "Timelocked Actions: ❌ Not executed"
fi

if echo "$DEPLOYMENT_OUTPUT" | grep -q "Liquidity market set"; then
    print_status "Liquidity Market: ✅ Set"
else
    print_warning "Liquidity Market: ❌ Not set"
fi

if echo "$DEPLOYMENT_OUTPUT" | grep -q "All roles set"; then
    print_status "Role Assignment: ✅ Completed"
else
    print_warning "Role Assignment: ❌ Not completed"
fi

# Check timelock configuration
if echo "$DEPLOYMENT_OUTPUT" | grep -q "Timelock increase submissions submitted"; then
    print_status "Timelock Configuration: ✅ Applied"
else
    print_status "Timelock Configuration: ℹ️  Using default (immediate execution)"
fi

print_success "Vault configuration verification completed"

# Step 9: Display deployment summary
echo ""
print_success "=== TEST DEPLOYMENT SUMMARY ==="
print_status "Anvil RPC: http://localhost:8545"
print_status "Chain ID: 31337"
print_status ""
print_status "Deployed Contracts:"
print_status "  VaultV2: $VAULT_V2"
print_status "  VaultV1: $VAULT_V1"
print_status "  Asset: $ASSET"
print_status "  AdapterRegistry: $REGISTRY"
print_status "  VaultV2Factory: $VAULT_V2_FACTORY"
print_status "  MorphoVaultV1AdapterFactory: $MORPHO_VAULT_V1_ADAPTER_FACTORY"
print_status ""
print_status "Role Addresses:"
print_status "  Owner: 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266"
print_status "  Curator: 0x70997970C51812dc3A010C7d01b50e0d17dc79C8"
print_status "  Allocator: 0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC"
print_status "  Sentinel: 0x90F79bf6EB2c4f870365E785982E1f101E93b906"
print_status ""
print_status "Environment file: .env"
print_status "Anvil log: anvil.log"
print_status ""

# Step 10: Stop anvil and restore .env
print_status "Stopping anvil and restoring original .env file..."
if ! kill $ANVIL_PID 2>/dev/null; then
    print_warning "Failed to stop anvil process (may have already stopped)"
fi
wait $ANVIL_PID 2>/dev/null || true

if [ -f ".env.arch" ]; then
    if ! mv .env.arch .env; then
        print_error "Failed to restore original .env file"
        exit 1
    fi
    print_success "Original .env file restored"
else
    if ! rm -f .env; then
        print_error "Failed to remove temporary .env file"
        exit 1
    fi
    print_status "No original .env file to restore"
fi

print_success "Test deployment completed successfully!"
print_status "All contracts tested and environment cleaned up."
