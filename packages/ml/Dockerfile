FROM python:3.12-slim

WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        libglib2.0-0 \
        libgomp1 \
        libxcb1 \
        libgl1 \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt requirements-yolo.txt ./
RUN pip install --no-cache-dir torch torchvision --index-url https://download.pytorch.org/whl/cpu \
    && pip install --no-cache-dir -r requirements.txt -r requirements-yolo.txt

COPY worker ./worker

CMD ["celery", "-A", "worker.app", "worker", "--loglevel=info"]
