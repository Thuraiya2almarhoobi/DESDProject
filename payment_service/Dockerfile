FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

WORKDIR /srv/payment_service

COPY payment_service/requirements.txt ./
RUN pip install --upgrade pip && pip install -r requirements.txt

COPY payment_service/ ./
RUN test -s /srv/payment_service/server.py

EXPOSE 8010

CMD ["python", "server.py"]
