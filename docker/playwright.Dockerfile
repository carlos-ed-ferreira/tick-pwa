FROM mcr.microsoft.com/playwright:v1.62.1-noble

RUN apt-get update && apt-get install --no-install-recommends -y make && rm -rf /var/lib/apt/lists/*
