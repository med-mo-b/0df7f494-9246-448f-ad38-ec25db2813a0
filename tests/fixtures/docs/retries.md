# Retry policy

The system retries failed requests with exponential backoff.
The default policy is 3 retries, starting at 100ms with a multiplier of 2.

## Tuning retries

When the upstream service is known to be flaky, increase the retry
budget rather than the per-attempt timeout. Excessive timeouts amplify
tail latency without improving overall success rates.
