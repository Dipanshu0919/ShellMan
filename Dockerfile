# ShellMan - Agentless Multi-Server Web OS & Linux Management System
FROM python:3.11-slim

# System dependencies:
# - openssh-client and rsync: Agentless remote file synchronization and SSH operations
# - curl: Container health checks
RUN apt-get update && apt-get install -y --no-install-recommends \
    openssh-client \
    rsync \
    curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Cache dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# Copy application source
COPY . .

# Ensure instance directory exists for persistent state (SQLite database, encryption key)
RUN mkdir -p /app/instance

# Expose Web OS port
EXPOSE 5000

# Environment configurations
ENV PYTHONUNBUFFERED=1 \
    HOST=0.0.0.0 \
    PORT=5000

# Persistent storage volume
VOLUME ["/app/instance"]

# Default start command (Gunicorn with gthread worker for WebSocket PTY compatibility)
CMD ["gunicorn", "-k", "gthread", "--threads", "16", "--workers", "1", "-b", "0.0.0.0:5000", "app:app"]

