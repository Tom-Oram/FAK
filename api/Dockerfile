FROM python:3.11-slim

# Install system dependencies for Scapy and SSH
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
    libpcap-dev \
    tcpdump \
    curl \
    openssh-client \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy API requirements and install Python dependencies
COPY api/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy pathtracer requirements and install dependencies
COPY pathtracer/requirements.txt ./pathtracer-requirements.txt
RUN pip install --no-cache-dir -r pathtracer-requirements.txt

# Copy application code
COPY api/traceroute.py .

# Copy pathtracer module
COPY pathtracer ./pathtracer

# Expose Flask port
EXPOSE 5000

# Run as root (required for raw sockets and SSH)
CMD ["python", "traceroute.py"]
