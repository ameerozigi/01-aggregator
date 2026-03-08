// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

interface IUniswapV2Pair {
    function token0() external view returns (address);
    function token1() external view returns (address);
    function getReserves() external view returns (uint112 reserve0, uint112 reserve1, uint32);
    function swap(uint amount0Out, uint amount1Out, address to, bytes calldata data) external;
}

/**
 * @title O1DexAggregator
 * @notice Aggregates swaps across multiple Uniswap V2-style pools on Base, supporting multi-hop and route splitting.
 * @dev Uses OpenZeppelin Ownable, Pausable, and ReentrancyGuard. Caller must approve tokenIn to this contract.
 */
contract O1DexAggregator is Ownable, Pausable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    constructor() Ownable(msg.sender) {}

    /// @notice Emitted after the entire aggregated swap completes
    /// @param sender The caller of the aggregation
    /// @param tokenIn The input ERC20 token
    /// @param tokenOut The output ERC20 token
    /// @param amountIn Total input amount provided
    /// @param amountOut Total output amount delivered to recipient
    /// @param recipient Final recipient of tokenOut
    /// @param routesCount Number of routes executed
    event AggregationSwap(
        address indexed sender,
        address indexed tokenIn,
        address indexed tokenOut,
        uint256 amountIn,
        uint256 amountOut,
        address recipient,
        uint256 routesCount
    );

    /// @notice Emitted per route
    /// @param routeIndex Index of the route
    /// @param amountIn Amount allocated to this route
    /// @param amountOut Amount produced by this route
    /// @param pairs The pairs traversed by this route
    event RouteExecuted(uint256 indexed routeIndex, uint256 amountIn, uint256 amountOut, address[] pairs);

    /// @notice Error thrown when parameters are invalid
    error InvalidParams();
    /// @notice Error thrown when a provided route is inconsistent with the current token
    error InvalidRoute(address pair, address expectedToken);
    /// @notice Error thrown when the final output is below the user-specified minimum
    error Slippage();

    /**
     * @notice Struct describing a single aggregation route
     * @dev shareBps is the portion of amountIn allocated to this route (0-10000).
     * @dev pairs is the ordered list of Uniswap V2 pairs for multi-hop.
     * @dev feeFactors optionally provides per-hop fee numerator (e.g., 997 for 0.3% fee); defaults to 997 if missing.
     */
    struct Route {
        uint256 shareBps;
        address[] pairs;
        uint24[] feeFactors;
    }

    /**
     * @notice Perform an aggregated token swap across multiple routes and hops
     * @param tokenIn The input token address
     * @param tokenOut The desired output token address
     * @param amountIn Total input amount to swap
     * @param minAmountOut Minimum acceptable output across all routes
     * @param recipient Address receiving the final output tokens
     * @param routes ABI-encoded Route structs describing each split and path
     * @dev Caller must have approved amountIn of tokenIn to this contract.
     * @dev Reverts if paused, invalid params, or aggregate output < minAmountOut.
     */
    function swap(
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 minAmountOut,
        address recipient,
        bytes[] calldata routes
    ) external whenNotPaused nonReentrant {
        if (tokenIn == address(0) || tokenOut == address(0) || tokenIn == tokenOut) revert InvalidParams();
        if (amountIn == 0 || recipient == address(0) || routes.length == 0) revert InvalidParams();

        IERC20(tokenIn).safeTransferFrom(msg.sender, address(this), amountIn);

        uint256 totalOut;
        uint256 usedIn;
        uint256 rLen = routes.length;

        for (uint256 i = 0; i < rLen; ) {
            Route memory r = _decodeRoute(routes[i]);
            if (r.pairs.length == 0) revert InvalidParams();

            uint256 split = (i == rLen - 1)
                ? amountIn - usedIn
                : (amountIn * r.shareBps) / 10000;
            usedIn += split;

            address currentToken = tokenIn;
            uint256 amount = split;

            IERC20(currentToken).safeTransfer(r.pairs[0], amount);

            uint256 hops = r.pairs.length;
            for (uint256 j = 0; j < hops; ) {
                IUniswapV2Pair pair = IUniswapV2Pair(r.pairs[j]);
                (address t0, address t1) = (pair.token0(), pair.token1());

                bool zeroForOne;
                if (currentToken == t0) {
                    zeroForOne = true;
                } else if (currentToken == t1) {
                    zeroForOne = false;
                } else {
                    revert InvalidRoute(address(pair), currentToken);
                }

                (uint112 r0, uint112 r1, ) = pair.getReserves();
                uint256 reserveIn = zeroForOne ? uint256(r0) : uint256(r1);
                uint256 reserveOut = zeroForOne ? uint256(r1) : uint256(r0);

                uint24 feeFactor = (r.feeFactors.length > j && r.feeFactors[j] != 0) ? r.feeFactors[j] : uint24(997);
                uint256 amountOut = _getAmountOut(amount, reserveIn, reserveOut, feeFactor);

                address to = (j + 1 < hops) ? r.pairs[j + 1] : recipient;
                uint256 amount0Out = zeroForOne ? 0 : amountOut;
                uint256 amount1Out = zeroForOne ? amountOut : 0;
                pair.swap(amount0Out, amount1Out, to, "");

                currentToken = zeroForOne ? t1 : t0;
                amount = amountOut;

                unchecked {
                    ++j;
                }
            }

            totalOut += amount;
            emit RouteExecuted(i, split, amount, r.pairs);

            unchecked {
                ++i;
            }
        }

        if (totalOut < minAmountOut) revert Slippage();

        emit AggregationSwap(msg.sender, tokenIn, tokenOut, amountIn, totalOut, recipient, rLen);
    }

    /**
     * @notice Pause the aggregator in emergencies
     * @dev Only callable by the owner
     */
    function pause() external onlyOwner {
        _pause();
    }

    /**
     * @notice Unpause the aggregator
     * @dev Only callable by the owner
     */
    function unpause() external onlyOwner {
        _unpause();
    }

    /**
     * @notice Compute Uniswap V2 amountOut given reserves and fee factor
     * @param amountIn Input amount
     * @param reserveIn Reserve of input token
     * @param reserveOut Reserve of output token
     * @param feeFactor Fee numerator (e.g., 997 means 0.3% fee)
     */
    function _getAmountOut(
        uint256 amountIn,
        uint256 reserveIn,
        uint256 reserveOut,
        uint24 feeFactor
    ) internal pure returns (uint256) {
        uint256 amountInWithFee = amountIn * feeFactor;
        uint256 numerator = amountInWithFee * reserveOut;
        uint256 denominator = reserveIn * 1000 + amountInWithFee;
        return numerator / denominator;
    }

    /**
     * @notice Decode a Route struct from calldata bytes
     * @param data ABI-encoded Route
     */
    function _decodeRoute(bytes calldata data) internal pure returns (Route memory r) {
        r = abi.decode(data, (Route));
    }
}
