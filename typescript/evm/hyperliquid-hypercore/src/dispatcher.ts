import type { Action, HyperliquidConfig, ValidatedActionConfig } from "./interfaces";
import { validateActionConfig } from "./validation";

type ConfigFor<A extends Action> = Extract<ValidatedActionConfig, { action: A }>;

export type ActionHandlers = {
    [A in Action]: (config: ConfigFor<A>) => Promise<unknown>;
};

export async function dispatchAction(
    config: HyperliquidConfig,
    masterAddress: `0x${string}`,
    handlers: ActionHandlers,
): Promise<unknown> {
    const validated = validateActionConfig(config, masterAddress);
    const handler = handlers[validated.action] as (value: ValidatedActionConfig) => Promise<unknown>;
    return handler(validated);
}
