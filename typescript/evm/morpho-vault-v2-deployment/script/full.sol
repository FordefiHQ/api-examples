// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity 0.8.28;

import {Script, console} from "forge-std/Script.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IMorphoMarketV1AdapterV2Factory} from "vault-v2/adapters/interfaces/IMorphoMarketV1AdapterV2Factory.sol";
import {IERC4626} from "@openzeppelin/contracts/interfaces/IERC4626.sol";
import {IMorpho, MarketParams, Id} from "metamorpho-v1.1-morpho-blue/src/interfaces/IMorpho.sol";
import {IMetaMorphoV1_1} from "metamorpho-v1.1/src/interfaces/IMetaMorphoV1_1.sol";
import {IMetaMorphoV1_1Factory} from "metamorpho-v1.1/src/interfaces/IMetaMorphoV1_1Factory.sol";
import {IVaultV2} from "vault-v2/interfaces/IVaultV2.sol";
import {VaultV2} from "vault-v2/VaultV2.sol";
import {VaultV2Factory} from "vault-v2/VaultV2Factory.sol";
import {MorphoVaultV1AdapterFactory} from "vault-v2/adapters/MorphoVaultV1AdapterFactory.sol";
import {IMorphoMarketV1AdapterV2} from "vault-v2/adapters/interfaces/IMorphoMarketV1AdapterV2.sol";

/// @notice Mintable ERC20 for testing
contract TestWETH is ERC20 {
    constructor() ERC20("Test Wrapped ETH", "testWETH") {}

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

/// @notice Mintable ERC20 for collateral testing
contract TestWstETH is ERC20 {
    constructor() ERC20("Test Wrapped stETH", "testwstETH") {}

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

/// @notice Mock oracle returning 1:1 price (1e36)
contract MockOracle {
    function price() external pure returns (uint256) {
        return 1e36;
    }
}

/// @notice Interface for MorphoChainlinkOracleV2Factory
interface IMorphoChainlinkOracleV2Factory {
    function createMorphoChainlinkOracleV2(
        IERC4626 baseVault,
        uint256 baseVaultConversionSample,
        address baseFeed1,
        address baseFeed2,
        uint256 baseTokenDecimals,
        IERC4626 quoteVault,
        uint256 quoteVaultConversionSample,
        address quoteFeed1,
        address quoteFeed2,
        uint256 quoteTokenDecimals,
        bytes32 salt
    ) external returns (address);
}

/**
 * @title FullDeployment
 * @notice Deploys complete Morpho ecosystem: tokens, markets, Vault V1, Vault V2, and both adapter types
 * @dev Phases 1-9: Infrastructure (tokens, oracle, markets with 90% utilization)
 *      Phase 10: Vault V1 (MetaMorpho) with 3-day timelock
 *      Phase 11: Vault V2 + MorphoVaultV1Adapter, MAX_RATE (200% APR)
 *      Phase 12-13: Dead deposit + MorphoMarketV1AdapterV2
 *      Phase 14: Finalize ownership (owner, curator, allocator, sentinel)
 */
contract FullDeployment is Script {
    uint256 constant LLTV = 860000000000000000;
    uint256 constant SUPPLY_AMOUNT = 10 * 1e18;
    uint256 constant COLLATERAL_AMOUNT = 20 * 1e18;
    uint256 constant BORROW_AMOUNT = 9 * 1e18;
    uint256 constant MARKET_CAP = 1000 * 1e18;
    uint256 constant DEAD_DEPOSIT_SHARES = 1e9;
    address constant DEAD_ADDRESS = 0x000000000000000000000000000000000000dEaD;
    uint256 constant MAX_RATE = 200e16 / uint256(365 days); // 200% APR - matches MAX_MAX_RATE from ConstantsLib
    uint256 constant THREE_DAYS = 3 days;

    TestWETH public loanToken;
    TestWstETH public collateralToken;
    address public oracle;
    Id public mainMarketId;
    Id public idleMarketId;
    IMetaMorphoV1_1 public vaultV1;
    VaultV2 public vaultV2;
    address public morphoVaultAdapter;
    address public morphoMarketAdapter;

    struct Config {
        address morphoAddress;
        address irmAddress;
        address vaultV1FactoryAddress;
        address oracleFactoryAddress;
        address vaultV2FactoryAddress;
        address adapterRegistry;
        address morphoVaultV1AdapterFactory;
        address morphoMarketV1AdapterV2Factory;
        address owner;
        address curator;
        address allocator;
        address sentinel;
        uint256 timelockDuration;
        uint256 adapterTimelockDuration;
        uint256 deadDepositAmount;
    }

    function run() external {
        Config memory config = _loadConfig();

        console.log("=== FULL MORPHO DEPLOYMENT ===");
        console.log("Deployer:", msg.sender);
        console.log("");

        vm.startBroadcast();

        // Phase 1: Deploy Loan Token
        _deployLoanToken();

        // Phase 2: Deploy Collateral Token
        _deployCollateralToken();

        // Phase 3: Deploy Oracle
        _deployOracle(config.oracleFactoryAddress);

        // Phase 4 & 5: Use existing IRM and LLTV
        console.log("Using IRM:", config.irmAddress);
        console.log("Using LLTV:", LLTV);
        console.log("");

        // Phase 6: Deploy Markets
        _deployMarkets(IMorpho(config.morphoAddress), config.irmAddress);

        // Phase 7: Supply Loan Tokens
        _supplyLoanTokens(IMorpho(config.morphoAddress), config.irmAddress);

        // Phase 8: Supply Collateral
        _supplyCollateral(IMorpho(config.morphoAddress), config.irmAddress);

        // Phase 9: Borrow (90% utilization)
        _borrow(IMorpho(config.morphoAddress), config.irmAddress);

        // Phase 10: Deploy Vault V1
        _deployVaultV1(config);

        // Phase 11: Deploy Vault V2 with MorphoVaultV1Adapter
        _deployVaultV2(config);

        // Phase 12: Dead Deposit on Morpho Market (for MorphoMarketV1AdapterV2)
        _marketDeadDeposit(IMorpho(config.morphoAddress), config.irmAddress);

        // Phase 13: Deploy and Configure MorphoMarketV1AdapterV2
        _deployMorphoMarketAdapter(config);

        // Phase 14: Finalize Vault V2 Ownership (after all adapters configured)
        _finalizeVaultV2Ownership(config);

        vm.stopBroadcast();

        // Print Summary
        _printSummary(config.irmAddress);
    }

    function _loadConfig() internal view returns (Config memory config) {
        config.morphoAddress = vm.envAddress("MORPHO_ADDRESS");
        config.irmAddress = vm.envAddress("IRM_ADDRESS");
        config.vaultV1FactoryAddress = vm.envAddress("VAULT_V1_FACTORY_ADDRESS");
        config.oracleFactoryAddress = vm.envOr("ORACLE_FACTORY_ADDRESS", address(0));
        config.vaultV2FactoryAddress = vm.envAddress("VAULT_V2_FACTORY");
        config.adapterRegistry = vm.envAddress("ADAPTER_REGISTRY");
        config.morphoVaultV1AdapterFactory = vm.envAddress("MORPHO_VAULT_V1_ADAPTER_FACTORY");
        config.morphoMarketV1AdapterV2Factory = vm.envAddress("MORPHO_MARKET_V1_ADAPTER_V2_FACTORY");
        config.owner = vm.envAddress("OWNER");
        config.curator = vm.envOr("CURATOR", config.owner);
        config.allocator = vm.envOr("ALLOCATOR", config.owner);
        config.sentinel = vm.envOr("SENTINEL", address(0));
        config.timelockDuration = vm.envOr("TIMELOCK_DURATION", uint256(0));
        config.adapterTimelockDuration = vm.envOr("ADAPTER_TIMELOCK_DURATION", THREE_DAYS);
        config.deadDepositAmount = vm.envOr("DEAD_DEPOSIT_AMOUNT", uint256(1e9));
    }

    function _deployLoanToken() internal {
        console.log("=== Phase 1: Deploy Loan Token ===");
        address existingLoanToken = vm.envOr("LOAN_TOKEN", address(0));
        if (existingLoanToken != address(0)) {
            loanToken = TestWETH(existingLoanToken);
            console.log("Using existing testWETH:", address(loanToken));
        } else {
            loanToken = new TestWETH();
            console.log("testWETH deployed at:", address(loanToken));
        }
        console.log("");
    }

    function _deployCollateralToken() internal {
        console.log("=== Phase 2: Deploy Collateral Token ===");
        address existingCollateralToken = vm.envOr("COLLATERAL_TOKEN", address(0));
        if (existingCollateralToken != address(0)) {
            collateralToken = TestWstETH(existingCollateralToken);
            console.log("Using existing testwstETH:", address(collateralToken));
        } else {
            collateralToken = new TestWstETH();
            console.log("testwstETH deployed at:", address(collateralToken));
        }
        console.log("");
    }

    function _deployOracle(address oracleFactory) internal {
        console.log("=== Phase 3: Deploy Oracle ===");

        address existingOracle = vm.envOr("DEPLOYED_ORACLE", address(0));
        if (existingOracle != address(0)) {
            oracle = existingOracle;
            console.log("Using existing oracle:", oracle);
        } else if (oracleFactory != address(0)) {
            // Use MorphoChainlinkOracleV2Factory
            bytes32 salt = keccak256(abi.encodePacked(block.timestamp, gasleft()));
            oracle = IMorphoChainlinkOracleV2Factory(oracleFactory)
                .createMorphoChainlinkOracleV2(
                    IERC4626(address(0)), // baseVault - no vault
                    1, // baseVaultConversionSample
                    address(0), // baseFeed1 - no feed
                    address(0), // baseFeed2 - no feed
                    18, // baseTokenDecimals (testwstETH)
                    IERC4626(address(0)), // quoteVault - no vault
                    1, // quoteVaultConversionSample
                    address(0), // quoteFeed1 - no feed
                    address(0), // quoteFeed2 - no feed
                    18, // quoteTokenDecimals (testWETH)
                    salt
                );
            console.log("MorphoChainlinkOracleV2 deployed at:", oracle);
        } else {
            // Deploy mock oracle
            MockOracle mockOracle = new MockOracle();
            oracle = address(mockOracle);
            console.log("MockOracle deployed at:", oracle);
        }
        console.log("");
    }

    function _deployMarkets(IMorpho morpho, address irm) internal {
        console.log("=== Phase 6: Deploy Markets ===");

        // Main Market
        MarketParams memory mainMarketParams = MarketParams({
            loanToken: address(loanToken),
            collateralToken: address(collateralToken),
            oracle: oracle,
            irm: irm,
            lltv: LLTV
        });
        mainMarketId = _computeMarketId(mainMarketParams);

        // Check if main market exists
        if (morpho.market(mainMarketId).lastUpdate == 0) {
            morpho.createMarket(mainMarketParams);
            console.log("Main market created");
        } else {
            console.log("Main market already exists");
        }
        console.log("  Market ID (bytes32):", vm.toString(Id.unwrap(mainMarketId)));
        console.log("  Market ID (uint256):", uint256(Id.unwrap(mainMarketId)));

        // Idle Market
        MarketParams memory idleMarketParams = MarketParams({
            loanToken: address(loanToken), collateralToken: address(0), oracle: address(0), irm: address(0), lltv: 0
        });

        idleMarketId = _computeMarketId(idleMarketParams);

        // Check if idle market exists
        if (morpho.market(idleMarketId).lastUpdate == 0) {
            morpho.createMarket(idleMarketParams);
            console.log("Idle market created");
        } else {
            console.log("Idle market already exists");
        }
        console.log("  Market ID (bytes32):", vm.toString(Id.unwrap(idleMarketId)));
        console.log("  Market ID (uint256):", uint256(Id.unwrap(idleMarketId)));
        console.log("");
    }

    function _supplyLoanTokens(IMorpho morpho, address irm) internal {
        console.log("=== Phase 7: Supply Loan Tokens ===");

        // Check if already supplied
        if (morpho.market(mainMarketId).totalSupplyAssets >= SUPPLY_AMOUNT) {
            console.log(
                "Loan tokens already supplied:", morpho.market(mainMarketId).totalSupplyAssets / 1e18, "testWETH"
            );
            console.log("");
            return;
        }

        loanToken.mint(msg.sender, SUPPLY_AMOUNT);
        loanToken.approve(address(morpho), type(uint256).max);

        MarketParams memory mainMarketParams = MarketParams({
            loanToken: address(loanToken),
            collateralToken: address(collateralToken),
            oracle: oracle,
            irm: irm,
            lltv: LLTV
        });

        morpho.supply(mainMarketParams, SUPPLY_AMOUNT, 0, msg.sender, "");
        console.log("Supplied", SUPPLY_AMOUNT / 1e18, "testWETH to main market");
        console.log("");
    }

    function _supplyCollateral(IMorpho morpho, address irm) internal {
        console.log("=== Phase 8: Supply Collateral ===");

        // Check if we already borrowed (indicates collateral was supplied)
        if (morpho.market(mainMarketId).totalBorrowAssets > 0) {
            console.log("Collateral already supplied (borrowing active)");
            console.log("");
            return;
        }

        collateralToken.mint(msg.sender, COLLATERAL_AMOUNT);
        collateralToken.approve(address(morpho), type(uint256).max);

        MarketParams memory mainMarketParams = MarketParams({
            loanToken: address(loanToken),
            collateralToken: address(collateralToken),
            oracle: oracle,
            irm: irm,
            lltv: LLTV
        });

        morpho.supplyCollateral(mainMarketParams, COLLATERAL_AMOUNT, msg.sender, "");
        console.log("Supplied", COLLATERAL_AMOUNT / 1e18, "testwstETH as collateral");
        console.log("");
    }

    function _borrow(IMorpho morpho, address irm) internal {
        console.log("=== Phase 9: Borrow (90% Utilization) ===");

        // Check if already borrowed
        if (morpho.market(mainMarketId).totalBorrowAssets >= BORROW_AMOUNT) {
            console.log("Already borrowed:", morpho.market(mainMarketId).totalBorrowAssets / 1e18, "testWETH");
            console.log("");
            return;
        }

        MarketParams memory mainMarketParams = MarketParams({
            loanToken: address(loanToken),
            collateralToken: address(collateralToken),
            oracle: oracle,
            irm: irm,
            lltv: LLTV
        });

        morpho.borrow(mainMarketParams, BORROW_AMOUNT, 0, msg.sender, msg.sender);
        console.log("Borrowed", BORROW_AMOUNT / 1e18, "testWETH (90% utilization)");
        console.log("");
    }

    function _deployVaultV1(Config memory config) internal {
        console.log("=== Phase 10: Deploy Vault V1 ===");

        IMetaMorphoV1_1Factory factory = IMetaMorphoV1_1Factory(config.vaultV1FactoryAddress);
        bytes32 salt = keccak256(abi.encodePacked("VaultV1", block.timestamp));

        vaultV1 = factory.createMetaMorpho(msg.sender, 0, address(loanToken), "Test Vault V1", "TVAULT1", salt);
        console.log("Vault V1 deployed at:", address(vaultV1));

        vaultV1.setCurator(msg.sender);
        console.log("Curator set to deployer (temporary)");

        MarketParams memory idleMarketParams = MarketParams({
            loanToken: address(loanToken), collateralToken: address(0), oracle: address(0), irm: address(0), lltv: 0
        });

        vaultV1.submitCap(idleMarketParams, type(uint184).max);
        vaultV1.acceptCap(idleMarketParams);

        Id[] memory supplyQueue = new Id[](1);
        supplyQueue[0] = idleMarketId;
        vaultV1.setSupplyQueue(supplyQueue);
        console.log("Idle market configured");

        MarketParams memory mainMarketParams = MarketParams({
            loanToken: address(loanToken),
            collateralToken: address(collateralToken),
            oracle: oracle,
            irm: config.irmAddress,
            lltv: LLTV
        });

        vaultV1.submitCap(mainMarketParams, MARKET_CAP);
        vaultV1.acceptCap(mainMarketParams);

        Id[] memory newSupplyQueue = new Id[](2);
        newSupplyQueue[0] = idleMarketId;
        newSupplyQueue[1] = mainMarketId;
        vaultV1.setSupplyQueue(newSupplyQueue);
        console.log("Main market configured");

        uint256 assetsNeeded = vaultV1.previewMint(DEAD_DEPOSIT_SHARES);
        loanToken.mint(msg.sender, assetsNeeded);
        loanToken.approve(address(vaultV1), assetsNeeded);
        vaultV1.mint(DEAD_DEPOSIT_SHARES, DEAD_ADDRESS);
        console.log("Dead deposit completed:", DEAD_DEPOSIT_SHARES, "shares");

        if (config.curator != msg.sender) {
            vaultV1.setCurator(config.curator);
            console.log("Final curator set:", config.curator);
        }

        // Set 3-day timelock on Vault V1 before transferring ownership
        // Since current timelock is 0 and we're increasing, it's set immediately (no pending)
        vaultV1.submitTimelock(THREE_DAYS);
        console.log("Vault V1 timelock set to:", THREE_DAYS, "seconds (3 days)");

        vaultV1.transferOwnership(config.owner);
        console.log("Ownership transferred to:", config.owner);
        console.log("");
    }

    function _deployVaultV2(Config memory config) internal {
        console.log("=== Phase 11: Deploy Vault V2 ===");

        bytes32 salt = keccak256(abi.encodePacked("VaultV2", block.timestamp, gasleft()));
        vaultV2 =
            VaultV2(VaultV2Factory(config.vaultV2FactoryAddress).createVaultV2(msg.sender, address(loanToken), salt));
        console.log("Vault V2 deployed at:", address(vaultV2));

        vaultV2.setCurator(msg.sender);
        console.log("Temporary curator set");

        morphoVaultAdapter = MorphoVaultV1AdapterFactory(config.morphoVaultV1AdapterFactory)
            .createMorphoVaultV1Adapter(address(vaultV2), address(vaultV1));
        console.log("MorphoVaultV1Adapter deployed at:", morphoVaultAdapter);

        bytes memory adapterIdData = abi.encode("this", morphoVaultAdapter);
        vaultV2.submit(abi.encodeCall(vaultV2.setIsAllocator, (msg.sender, true)));
        vaultV2.submit(abi.encodeCall(vaultV2.setAdapterRegistry, (config.adapterRegistry)));
        vaultV2.submit(abi.encodeCall(vaultV2.setLiquidityAdapterAndData, (morphoVaultAdapter, bytes(""))));
        vaultV2.submit(abi.encodeCall(vaultV2.addAdapter, (morphoVaultAdapter)));
        vaultV2.submit(abi.encodeCall(vaultV2.increaseAbsoluteCap, (adapterIdData, type(uint128).max)));
        vaultV2.submit(abi.encodeCall(vaultV2.increaseRelativeCap, (adapterIdData, 1e18)));
        console.log("Timelocked changes submitted");

        vaultV2.setAdapterRegistry(config.adapterRegistry);
        vaultV2.setIsAllocator(msg.sender, true);
        vaultV2.addAdapter(morphoVaultAdapter);
        vaultV2.setLiquidityAdapterAndData(morphoVaultAdapter, bytes(""));
        vaultV2.increaseAbsoluteCap(adapterIdData, type(uint128).max);
        vaultV2.increaseRelativeCap(adapterIdData, 1e18);
        vaultV2.setMaxRate(MAX_RATE);
        console.log("Immediate changes executed");
        console.log("MaxRate set to:", MAX_RATE, "(200% APR)");

        vaultV2.submit(abi.encodeCall(vaultV2.abdicate, (IVaultV2.setAdapterRegistry.selector)));
        vaultV2.abdicate(IVaultV2.setAdapterRegistry.selector);
        console.log("setAdapterRegistry abdicated");

        if (config.timelockDuration > 0) {
            _configureTimelocks(config.timelockDuration);
        }

        if (config.deadDepositAmount > 0) {
            loanToken.mint(msg.sender, config.deadDepositAmount);
            loanToken.approve(address(vaultV2), config.deadDepositAmount);
            vaultV2.deposit(config.deadDepositAmount, DEAD_ADDRESS);
            console.log("Dead deposit completed:", config.deadDepositAmount, "wei");
        }

        console.log("");
    }

    /// @dev Finalize VaultV2 ownership after all adapters are configured
    function _finalizeVaultV2Ownership(Config memory config) internal {
        console.log("=== Phase 14: Finalize Vault V2 Ownership ===");

        if (msg.sender != config.allocator) {
            vaultV2.submit(abi.encodeCall(vaultV2.setIsAllocator, (msg.sender, false)));
            vaultV2.submit(abi.encodeCall(vaultV2.setIsAllocator, (config.allocator, true)));
            vaultV2.setIsAllocator(msg.sender, false);
            vaultV2.setIsAllocator(config.allocator, true);
        }
        console.log("Allocator set:", config.allocator);

        vaultV2.setCurator(config.curator);
        console.log("Curator set:", config.curator);

        if (config.sentinel != address(0)) {
            vaultV2.setIsSentinel(config.sentinel, true);
            console.log("Sentinel set:", config.sentinel);
        }

        vaultV2.setOwner(config.owner);
        console.log("Owner set:", config.owner);
        console.log("");
    }

    /// @dev Per directives.md: Each market MUST have at least 1e9 shares deposited to 0xdead
    function _marketDeadDeposit(IMorpho morpho, address irm) internal {
        console.log("=== Phase 12: Market Dead Deposit ===");

        MarketParams memory mainMarketParams = MarketParams({
            loanToken: address(loanToken),
            collateralToken: address(collateralToken),
            oracle: oracle,
            irm: irm,
            lltv: LLTV
        });

        uint256 currentDeadShares = morpho.position(mainMarketId, DEAD_ADDRESS).supplyShares;
        console.log("Current dead shares on market:", currentDeadShares);

        if (currentDeadShares >= DEAD_DEPOSIT_SHARES) {
            console.log("Market already has sufficient dead deposit");
            console.log("");
            return;
        }

        uint256 sharesNeeded = DEAD_DEPOSIT_SHARES - currentDeadShares;
        uint256 assetsToSupply = sharesNeeded + 1; // Buffer for rounding
        loanToken.mint(msg.sender, assetsToSupply);
        loanToken.approve(address(morpho), assetsToSupply);
        morpho.supply(mainMarketParams, assetsToSupply, 0, DEAD_ADDRESS, "");

        uint256 newDeadShares = morpho.position(mainMarketId, DEAD_ADDRESS).supplyShares;
        console.log("Dead shares after deposit:", newDeadShares);
        require(newDeadShares >= DEAD_DEPOSIT_SHARES, "Insufficient dead deposit on market");
        console.log("");
    }

    /// @dev Connects VaultV2 directly to Morpho Blue markets
    function _deployMorphoMarketAdapter(Config memory config) internal {
        console.log("=== Phase 13: Deploy MorphoMarketV1AdapterV2 ===");

        morphoMarketAdapter = IMorphoMarketV1AdapterV2Factory(config.morphoMarketV1AdapterV2Factory)
            .createMorphoMarketV1AdapterV2(address(vaultV2));
        console.log("MorphoMarketV1AdapterV2 deployed at:", morphoMarketAdapter);

        require(
            IMorphoMarketV1AdapterV2Factory(config.morphoMarketV1AdapterV2Factory)
                .isMorphoMarketV1AdapterV2(morphoMarketAdapter),
            "Adapter not registered in factory"
        );
        console.log("Factory verification passed");

        IMorphoMarketV1AdapterV2 adapter = IMorphoMarketV1AdapterV2(morphoMarketAdapter);
        require(adapter.morpho() == config.morphoAddress, "Morpho address mismatch");
        require(adapter.adaptiveCurveIrm() == config.irmAddress, "IRM address mismatch");
        require(adapter.parentVault() == address(vaultV2), "Parent vault mismatch");
        console.log("Adapter configuration verified");

        // Register adapter with caps (ID structure: adapterId, collateralToken, this/marketParams)
        bytes memory adapterIdData = abi.encode("this", morphoMarketAdapter);
        vaultV2.submit(abi.encodeCall(vaultV2.addAdapter, (morphoMarketAdapter)));
        vaultV2.submit(abi.encodeCall(vaultV2.increaseAbsoluteCap, (adapterIdData, type(uint128).max)));
        vaultV2.submit(abi.encodeCall(vaultV2.increaseRelativeCap, (adapterIdData, 1e18)));
        vaultV2.addAdapter(morphoMarketAdapter);
        vaultV2.increaseAbsoluteCap(adapterIdData, type(uint128).max);
        vaultV2.increaseRelativeCap(adapterIdData, 1e18);
        console.log("Adapter registered in Vault V2");

        bytes memory collateralIdData = abi.encode("collateralToken", address(collateralToken));
        vaultV2.submit(abi.encodeCall(vaultV2.increaseAbsoluteCap, (collateralIdData, type(uint128).max)));
        vaultV2.submit(abi.encodeCall(vaultV2.increaseRelativeCap, (collateralIdData, 1e18)));
        vaultV2.increaseAbsoluteCap(collateralIdData, type(uint128).max);
        vaultV2.increaseRelativeCap(collateralIdData, 1e18);
        console.log("Collateral token caps configured");

        MarketParams memory mainMarketParams = MarketParams({
            loanToken: address(loanToken),
            collateralToken: address(collateralToken),
            oracle: oracle,
            irm: config.irmAddress,
            lltv: LLTV
        });
        bytes memory marketParamsIdData = abi.encode("this/marketParams", morphoMarketAdapter, mainMarketParams);
        vaultV2.submit(abi.encodeCall(vaultV2.increaseAbsoluteCap, (marketParamsIdData, MARKET_CAP)));
        vaultV2.submit(abi.encodeCall(vaultV2.increaseRelativeCap, (marketParamsIdData, 1e18)));
        vaultV2.increaseAbsoluteCap(marketParamsIdData, MARKET_CAP);
        vaultV2.increaseRelativeCap(marketParamsIdData, 1e18);
        console.log("Market caps configured");

        if (config.adapterTimelockDuration > 0) {
            _configureAdapterTimelocks(adapter, config.adapterTimelockDuration);
        }

        console.log("");
    }

    function _configureAdapterTimelocks(IMorphoMarketV1AdapterV2 adapter, uint256 timelockDuration) internal {
        console.log("Configuring adapter timelocks...");

        // IMPORTANT: Set increaseTimelock.selector LAST because once it's timelocked,
        // subsequent increaseTimelock calls will require waiting for the timelock to expire
        bytes4[] memory selectors = new bytes4[](4);
        selectors[0] = IMorphoMarketV1AdapterV2.abdicate.selector;
        selectors[1] = IMorphoMarketV1AdapterV2.setSkimRecipient.selector;
        selectors[2] = IMorphoMarketV1AdapterV2.burnShares.selector;
        selectors[3] = IMorphoMarketV1AdapterV2.increaseTimelock.selector; // Must be last!

        for (uint256 i = 0; i < selectors.length; i++) {
            adapter.submit(abi.encodeCall(adapter.increaseTimelock, (selectors[i], timelockDuration)));
            adapter.increaseTimelock(selectors[i], timelockDuration);
        }
        console.log("Adapter timelocks configured:", timelockDuration, "seconds (3 days)");
    }

    function _configureTimelocks(uint256 timelockDuration) internal {
        bytes4[] memory selectors = new bytes4[](10);
        selectors[0] = IVaultV2.setReceiveSharesGate.selector;
        selectors[1] = IVaultV2.setSendSharesGate.selector;
        selectors[2] = IVaultV2.setReceiveAssetsGate.selector;
        selectors[3] = IVaultV2.addAdapter.selector;
        selectors[4] = IVaultV2.increaseAbsoluteCap.selector;
        selectors[5] = IVaultV2.increaseRelativeCap.selector;
        selectors[6] = IVaultV2.setForceDeallocatePenalty.selector;
        selectors[7] = IVaultV2.abdicate.selector;
        selectors[8] = IVaultV2.removeAdapter.selector;
        selectors[9] = IVaultV2.increaseTimelock.selector;

        for (uint256 i = 0; i < selectors.length; i++) {
            vaultV2.submit(abi.encodeCall(vaultV2.increaseTimelock, (selectors[i], timelockDuration)));
            vaultV2.increaseTimelock(selectors[i], timelockDuration);
        }
        console.log("Timelocks configured:", timelockDuration, "seconds");
    }

    function _computeMarketId(MarketParams memory params) internal pure returns (Id) {
        return Id.wrap(
            keccak256(abi.encode(params.loanToken, params.collateralToken, params.oracle, params.irm, params.lltv))
        );
    }

    function _printSummary(address irm) internal view {
        console.log("");
        console.log("=== DEPLOYMENT SUMMARY ===");
        console.log("Loan Token (testWETH):", address(loanToken));
        console.log("Collateral Token (testwstETH):", address(collateralToken));
        console.log("Oracle:", oracle);
        console.log("IRM:", irm);
        console.log("LLTV:", LLTV);
        console.log("");
        console.log("Main Market ID (bytes32):", vm.toString(Id.unwrap(mainMarketId)));
        console.log("Main Market ID (uint256):", uint256(Id.unwrap(mainMarketId)));
        console.log("");
        console.log("Idle Market ID (bytes32):", vm.toString(Id.unwrap(idleMarketId)));
        console.log("Idle Market ID (uint256):", uint256(Id.unwrap(idleMarketId)));
        console.log("");
        console.log("Vault V1:", address(vaultV1));
        console.log("Vault V2:", address(vaultV2));
        console.log("");
        console.log("Adapters:");
        console.log("- MorphoVaultV1Adapter:", morphoVaultAdapter);
        console.log("- MorphoMarketV1AdapterV2:", morphoMarketAdapter);
        console.log("");
        console.log("Market State:");
        console.log("- Supplied: 10 testWETH");
        console.log("- Collateral: 20 testwstETH");
        console.log("- Borrowed: 9 testWETH");
        console.log("- Utilization: 90%");
        console.log("- Dead deposit on market: 1e9 shares to 0xdead");
        console.log("=========================");
    }
}
