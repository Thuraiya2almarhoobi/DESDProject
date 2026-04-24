# Multi-stage build:
# 1. Build the React/Vite frontend assets.
# 2. Copy them into the Django runtime image so one web container can serve
#    both the API and the SPA.
FROM node:22-slim AS frontend-build

WORKDIR /frontend

# Frontend build-time environment passed through to Vite.
ARG VITE_GOOGLE_MAPS_API_KEY
ENV VITE_GOOGLE_MAPS_API_KEY=${VITE_GOOGLE_MAPS_API_KEY}
ARG VITE_DELIVERY_SIMULATION_POLL_SECONDS
ENV VITE_DELIVERY_SIMULATION_POLL_SECONDS=${VITE_DELIVERY_SIMULATION_POLL_SECONDS}

COPY DESD/package*.json ./
RUN npm install

COPY DESD/ ./
RUN npm run build


FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

WORKDIR /app

# Python image needs compiler/PostgreSQL headers for backend dependencies.
RUN apt-get update && apt-get install -y \
    gcc \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt /app/
RUN pip install --upgrade pip
RUN pip install -r requirements.txt

COPY . /app/
COPY --from=frontend-build /frontend/dist /app/DESD/dist

EXPOSE 8000

# Startup mirrors the local dev workflow: migrate, seed demo data, then serve.
CMD ["sh", "-c", "python manage.py migrate && python manage.py seed_demo_data && python manage.py seed_catalog_demo && python manage.py runserver 0.0.0.0:8000"]
