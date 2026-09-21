import { CacheProvider } from "./cache_provider.js";
import { config } from "./config.js";

describe("CacheProvider", () => {
  it("should cache and expire values", () => {
    config.USE_CACHETOOLS = true;
    const cache = new CacheProvider<string>(10, -1); // negative TTL
    cache.set("key", "value");
    expect(cache.get("key")).toBeUndefined(); // expired

    const cache2 = new CacheProvider<string>(10, 3600);
    cache2.set("key", "value");
    expect(cache2.get("key")).toBe("value");

    const cache3 = new CacheProvider<string>(1, 3600);
    cache3.set("key1", "val1");
    cache3.set("key2", "val2");
    expect(cache3.get("key1")).toBeUndefined();
    expect(cache3.get("key2")).toBe("val2");
  });
});
