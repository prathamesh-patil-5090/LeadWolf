import { PipelineStep } from '../../generated/prisma/client';

export class PipelineStepError extends Error {
  constructor(
    public readonly step: PipelineStep,
    message: string,
    public readonly retryable = false,
  ) {
    super(message);
    this.name = 'PipelineStepError';
  }
}

export function isRetryablePipelineError(error: unknown) {
  if (error instanceof PipelineStepError) {
    return error.retryable;
  }

  if (!(error instanceof Error)) {
    return false;
  }

  const message = error.message.toLowerCase();
  return (
    message.includes('rate limit') ||
    message.includes('rate-limited') ||
    message.includes('daily limit') ||
    message.includes('429') ||
    message.includes('timeout') ||
    message.includes('econnreset') ||
    message.includes('network')
  );
}

export function toPipelineStepError(
  step: PipelineStep,
  error: unknown,
): PipelineStepError {
  if (error instanceof PipelineStepError) {
    return error;
  }

  const message =
    error instanceof Error ? error.message : 'Pipeline step failed';

  return new PipelineStepError(step, message, isRetryablePipelineError(error));
}
