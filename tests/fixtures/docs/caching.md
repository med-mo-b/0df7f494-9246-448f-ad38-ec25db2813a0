# Caching

We cache responses in-memory with a TTL of 60 seconds. Cache misses
fall through to the origin. There is no retry on cache miss; the
caller is expected to handle origin failures themselves.
