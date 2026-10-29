# ─────────────────────────────────────────────────────────────────────────────
# AMUST CodeArena — Isolated Sandboxed Judge Runner Container
# Milestone 8: Secure Multi-Language Container Runner
# ─────────────────────────────────────────────────────────────────────────────
FROM debian:bookworm-slim

# Prevent interactive prompts during installation
ENV DEBIAN_FRONTEND=noninteractive

# Install modern C++ (GCC 12/13), Python 3, OpenJDK 17, and Node.js
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    g++ \
    python3 \
    python3-minimal \
    openjdk-17-jdk-headless \
    nodejs \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/* \
    && rm -rf /tmp/* /var/tmp/*

# Create unprivileged sandbox user (UID 1000)
RUN useradd -m -u 1000 -s /bin/bash judgeuser

# Create standard sandbox directory
RUN mkdir -p /sandbox && chown judgeuser:judgeuser /sandbox && chmod 777 /sandbox

WORKDIR /sandbox
USER judgeuser

# Default entrypoint
CMD ["/bin/bash"]
