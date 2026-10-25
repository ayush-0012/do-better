import type { EngineParams } from "./constants";
import { RequestPattern } from "./constants";
import {
  createRandomizedRequestRate,
  getBurstRequestRate,
  getRampRequestRate,
  makeApiCalls,
  prepareEngineParams,
} from "./utils/helper";

export async function runEngine(params: EngineParams): Promise<void> {
  const preparedParams = prepareEngineParams(params);

  // running the engine based on the request pattern (handling different type of req patterns)
  switch (preparedParams.requestPattern) {
    case RequestPattern.Constant:
      return makeApiCalls(preparedParams, () => preparedParams.requestRate);
    case RequestPattern.Ramp:
      return makeApiCalls(preparedParams, (elapsedSeconds) =>
        getRampRequestRate(
          preparedParams.requestRate,
          preparedParams.duration,
          elapsedSeconds,
        ),
      );
    case RequestPattern.Burst:
      return makeApiCalls(preparedParams, (elapsedSeconds) =>
        getBurstRequestRate(preparedParams.requestRate, elapsedSeconds),
      );
    case RequestPattern.Randomized:
      return makeApiCalls(
        preparedParams,
        createRandomizedRequestRate(preparedParams.requestRate),
      );
  }
}
