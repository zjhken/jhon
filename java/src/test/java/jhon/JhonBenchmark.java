package jhon;

import org.openjdk.jmh.annotations.*;
import org.openjdk.jmh.infra.Blackhole;

import java.util.*;
import java.util.concurrent.TimeUnit;

/**
 * JMH benchmarks mirroring rust/benches/benchmark.rs inputs so cross-language
 * comparisons are apples-to-apples.
 */
@BenchmarkMode(Mode.AverageTime)
@OutputTimeUnit(TimeUnit.NANOSECONDS)
@Warmup(iterations = 3, time = 1)
@Measurement(iterations = 5, time = 1)
@Fork(1)
@State(Scope.Benchmark)
public class JhonBenchmark {

    private static final String SMALL_JHON = "name=\"John Doe\",age=30,active=true,score=95.5";
    private static final String SMALL_JSON = "{\"name\":\"John Doe\",\"age\":30,\"active\":true,\"score\":95.5}";

    private static final String MEDIUM_JHON = """
            server={host="localhost",port=8080,ssl={enabled=true,cert_path="/etc/ssl/cert.pem"}},
            database={host="db.example.com",port=5432,name="myapp",pool={min_size=5,max_size=100,timeout=30_000}},
            features=["auth","logging","caching"],
            debug=false,
            version=1_000_000
            """;

    private static final String MEDIUM_JSON = """
            {
                "server": {"host": "localhost", "port": 8080, "ssl": {"enabled": true, "cert_path": "/etc/ssl/cert.pem"}},
                "database": {"host": "db.example.com", "port": 5432, "name": "myapp", "pool": {"min_size": 5, "max_size": 100, "timeout": 30000}},
                "features": ["auth", "logging", "caching"],
                "debug": false,
                "version": 1000000
            }""";

    private Object smallValue;
    private Object mediumValue;

    @Setup
    public void setup() throws Exception {
        // Use JSON to build the canonical values to avoid leaking JHON's
        // serializer behavior into the benchmark.
        com.google.gson.Gson gson = new com.google.gson.Gson();
        smallValue = gson.fromJson(SMALL_JSON, Object.class);
        mediumValue = gson.fromJson(MEDIUM_JSON, Object.class);
    }

    // ===== Parse =====

    @Benchmark
    public void parseJhonSmall(Blackhole bh) throws Exception {
        bh.consume(Jhon.parse(SMALL_JHON));
    }

    @Benchmark
    public void parseJsonSmall(Blackhole bh) {
        bh.consume(new com.google.gson.Gson().fromJson(SMALL_JSON, Object.class));
    }

    @Benchmark
    public void parseJhonMedium(Blackhole bh) throws Exception {
        bh.consume(Jhon.parse(MEDIUM_JHON));
    }

    @Benchmark
    public void parseJsonMedium(Blackhole bh) {
        bh.consume(new com.google.gson.Gson().fromJson(MEDIUM_JSON, Object.class));
    }

    // ===== Serialize =====

    @Benchmark
    public void serializeJhonSmall(Blackhole bh) {
        bh.consume(Jhon.serialize(smallValue));
    }

    @Benchmark
    public void serializeJsonSmall(Blackhole bh) {
        bh.consume(new com.google.gson.Gson().toJson(smallValue));
    }

    @Benchmark
    public void serializeJhonMedium(Blackhole bh) {
        bh.consume(Jhon.serialize(mediumValue));
    }

    @Benchmark
    public void serializeJsonMedium(Blackhole bh) {
        bh.consume(new com.google.gson.Gson().toJson(mediumValue));
    }
}
