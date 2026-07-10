FROM python:3.12-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

ENV PYTHONPATH=/app

# Run as non-root (CIS Docker Benchmark)
RUN groupadd -r macros && useradd -r -g macros -s /sbin/nologin macros \
    && chown -R macros:macros /app
USER macros

EXPOSE 8000

CMD ["sh", "-c", "alembic upgrade head && uvicorn app.main:app --host 0.0.0.0 --port 8000"]
